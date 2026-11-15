//! 计时监视：每秒检查一次正在进行的计时。
//!
//! - 更新托盘提示（显示正在学的计划和今天已学时长）；
//! - 倒计时归零（今天的目标学完）时提醒，计时继续，由用户决定是否暂停；
//! - 单次计时超过设定时长时提醒休息。
//!
//! 在后台线程运行，窗口隐藏到托盘时依然有效。

use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use chrono::Utc;
use tauri::{AppHandle, Manager, Runtime};

use super::reminder::{self, CountdownReminder};
use super::{notify, tray};
use crate::db::Db;
use crate::domain::model::TimerStatus;
use crate::domain::settings::Settings;
use crate::domain::{Ctx, overview, plans, settings};
use crate::error::AppResult;
use crate::time::resolve_timezone;

/// 针对当前这一次计时的提醒状态
#[derive(Default)]
struct WatchState {
    session_id: Option<i64>,
    /// 开始时今天的目标还没完成（已经超额后再开始的计时不提醒）
    started_below_target: bool,
    /// 这次计时已经学到了今天的目标（每次计时只提醒一次）
    target_reached: bool,
    long_session_notified: bool,
    last_tooltip: String,
    last_running: Option<bool>,
}

static STATE: Mutex<Option<WatchState>> = Mutex::new(None);

pub fn spawn<R: Runtime>(app: AppHandle<R>) {
    thread::spawn(move || {
        loop {
            refresh_now(&app);
            thread::sleep(Duration::from_secs(1));
        }
    });
}

struct Snapshot {
    settings: Settings,
    plan_name: Option<String>,
    status: TimerStatus,
}

fn snapshot(db: &Db) -> AppResult<Snapshot> {
    db.with(|conn| {
        let settings = settings::get(conn)?;
        let ctx = Ctx::new(
            Utc::now().timestamp_millis(),
            resolve_timezone(&settings.timezone),
        );
        let status = overview::timer_status(conn, &ctx)?;
        let plan_name = match &status.running {
            Some(session) => Some(plans::get(conn, session.plan_id)?.name),
            None => None,
        };
        Ok(Snapshot {
            settings,
            plan_name,
            status,
        })
    })
}

fn format_clock(seconds: i64) -> String {
    let seconds = seconds.max(0);
    format!(
        "{:02}:{:02}:{:02}",
        seconds / 3600,
        seconds % 3600 / 60,
        seconds % 60
    )
}

pub(super) fn format_minutes(minutes: i64) -> String {
    match (minutes / 60, minutes % 60) {
        (0, m) => format!("{m} 分钟"),
        (h, 0) => format!("{h} 小时"),
        (h, m) => format!("{h} 小时 {m} 分钟"),
    }
}

/// 一次检查后要执行的动作
#[derive(Debug, Default, PartialEq)]
struct Actions {
    running_session: Option<i64>,
    countdown_reminder: Option<CountdownReminder>,
    /// 需要提醒休息时，为已连续计时的分钟数
    long_session_minutes: Option<i64>,
    /// 托盘提示有变化时，为新的提示文字和是否在计时
    tray: Option<(String, bool)>,
}

impl WatchState {
    /// 根据最新状态决定要做什么。只改自身状态，不调用任何系统接口。
    fn observe(&mut self, snapshot: &Snapshot) -> Actions {
        let mut actions = Actions::default();
        let running = snapshot.status.running.as_ref();
        actions.running_session = running.map(|session| session.id);

        let tooltip = match (running, &snapshot.status.plan_today) {
            (Some(session), Some(progress)) => {
                let target_seconds = progress.target_minutes * 60;
                if self.session_id != Some(session.id) {
                    self.session_id = Some(session.id);
                    self.started_below_target = progress.studied_seconds < target_seconds;
                    self.target_reached = false;
                    self.long_session_notified = false;
                }
                let name = snapshot.plan_name.as_deref().unwrap_or("计划");

                // 倒计时归零：只提醒，计时继续。提醒关闭时也记下已经到达，
                // 免得之后打开开关时补发一次过时的提醒。
                if self.started_below_target
                    && !self.target_reached
                    && target_seconds > 0
                    && progress.studied_seconds >= target_seconds
                {
                    self.target_reached = true;
                    if snapshot.settings.countdown_reminder {
                        actions.countdown_reminder = Some(CountdownReminder {
                            session_id: session.id,
                            plan_name: name.to_string(),
                            target_minutes: progress.target_minutes,
                        });
                    }
                }

                // 长时间计时：提醒休息
                let limit = snapshot.settings.long_session_minutes;
                let elapsed_minutes = (snapshot.status.now_ms - session.start_at) / 60_000;
                if limit > 0 && elapsed_minutes >= limit && !self.long_session_notified {
                    self.long_session_notified = true;
                    actions.long_session_minutes = Some(elapsed_minutes);
                }

                let done = if target_seconds > 0 && progress.studied_seconds >= target_seconds {
                    "，目标已完成"
                } else {
                    ""
                };
                format!(
                    "Learnis · 正在学习 {name}\n今天已学 {}{done}",
                    format_clock(progress.studied_seconds)
                )
            }
            _ => {
                self.session_id = None;
                "Learnis".to_string()
            }
        };

        let is_running = running.is_some();
        if tooltip != self.last_tooltip || self.last_running != Some(is_running) {
            actions.tray = Some((tooltip.clone(), is_running));
            self.last_tooltip = tooltip;
            self.last_running = Some(is_running);
        }
        actions
    }
}

/// 立即检查一次（也供切换计时后马上刷新托盘）
pub fn refresh_now<R: Runtime>(app: &AppHandle<R>) {
    let Some(db) = app.try_state::<Db>() else {
        return;
    };
    let Ok(snapshot) = snapshot(&db) else {
        return;
    };
    let actions = {
        let Ok(mut guard) = STATE.lock() else {
            return;
        };
        guard
            .get_or_insert_with(WatchState::default)
            .observe(&snapshot)
    };

    // 以下调用都在锁外：托盘、窗口、通知接口在后台线程里会等主线程处理，
    // 持锁等待时主线程若也在调用本函数（托盘菜单、快捷键），两边会互相卡住。
    reminder::dismiss_stale(app, actions.running_session);
    if let Some(countdown) = actions.countdown_reminder {
        reminder::show(app, countdown);
    }
    if let Some(minutes) = actions.long_session_minutes {
        notify(
            app,
            "休息一下吧",
            &format!(
                "已经连续计时 {}，起来活动活动再继续",
                format_minutes(minutes)
            ),
        );
    }
    if let Some((tooltip, running)) = actions.tray {
        tray::update(app, &tooltip, running);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::model::{PlanDayProgress, Session, SessionSource};

    const MINUTE_MS: i64 = 60_000;

    fn snapshot_at(
        session_id: i64,
        elapsed_minutes: i64,
        target_minutes: i64,
        studied_minutes: i64,
    ) -> Snapshot {
        Snapshot {
            settings: Settings::default(),
            plan_name: Some("After Effects".into()),
            status: TimerStatus {
                now_ms: elapsed_minutes * MINUTE_MS,
                today: "2026-11-14".into(),
                running: Some(Session {
                    id: session_id,
                    plan_id: 1,
                    start_at: 0,
                    end_at: None,
                    source: SessionSource::Timer,
                    note: String::new(),
                }),
                plan_today: Some(PlanDayProgress {
                    plan_id: 1,
                    target_minutes,
                    studied_seconds: studied_minutes * 60,
                }),
            },
        }
    }

    fn idle() -> Snapshot {
        let mut snapshot = snapshot_at(1, 0, 0, 0);
        snapshot.status.running = None;
        snapshot.status.plan_today = None;
        snapshot.plan_name = None;
        snapshot
    }

    #[test]
    fn formats_clock_and_minutes() {
        assert_eq!(format_clock(3725), "01:02:05");
        assert_eq!(format_clock(-3), "00:00:00");
        assert_eq!(format_minutes(45), "45 分钟");
        assert_eq!(format_minutes(120), "2 小时");
        assert_eq!(format_minutes(135), "2 小时 15 分钟");
    }

    #[test]
    fn reminds_once_when_target_reached_and_keeps_running() {
        let mut state = WatchState::default();
        assert_eq!(
            state
                .observe(&snapshot_at(7, 0, 125, 60))
                .countdown_reminder,
            None
        );
        assert_eq!(
            state
                .observe(&snapshot_at(7, 64, 125, 124))
                .countdown_reminder,
            None
        );

        let reached = state.observe(&snapshot_at(7, 65, 125, 125));
        assert_eq!(
            reached.countdown_reminder,
            Some(CountdownReminder {
                session_id: 7,
                plan_name: "After Effects".into(),
                target_minutes: 125,
            })
        );
        // 计时仍在进行，只提醒不暂停
        assert_eq!(reached.running_session, Some(7));

        let later = state.observe(&snapshot_at(7, 90, 125, 150));
        assert_eq!(later.countdown_reminder, None);
        assert_eq!(later.running_session, Some(7));
    }

    #[test]
    fn no_reminder_when_switched_off() {
        let mut state = WatchState::default();
        let mut snapshot = snapshot_at(7, 0, 125, 60);
        snapshot.settings.countdown_reminder = false;
        state.observe(&snapshot);
        let mut reached = snapshot_at(7, 65, 125, 125);
        reached.settings.countdown_reminder = false;
        assert_eq!(state.observe(&reached).countdown_reminder, None);

        // 之后再打开开关，也不会补发过时的提醒
        assert_eq!(
            state
                .observe(&snapshot_at(7, 70, 125, 130))
                .countdown_reminder,
            None
        );
    }

    #[test]
    fn no_reminder_when_started_after_target_or_without_target() {
        let mut state = WatchState::default();
        state.observe(&snapshot_at(7, 0, 125, 130));
        assert_eq!(
            state
                .observe(&snapshot_at(7, 5, 125, 135))
                .countdown_reminder,
            None
        );

        let mut state = WatchState::default();
        state.observe(&snapshot_at(8, 0, 0, 0));
        assert_eq!(
            state.observe(&snapshot_at(8, 5, 0, 5)).countdown_reminder,
            None
        );
    }

    #[test]
    fn new_session_can_remind_again() {
        let mut state = WatchState::default();
        state.observe(&snapshot_at(7, 0, 60, 30));
        assert!(
            state
                .observe(&snapshot_at(7, 30, 60, 60))
                .countdown_reminder
                .is_some()
        );

        // 暂停后今天又多了目标（例如手动调整），新的计时到达时再提醒
        state.observe(&idle());
        state.observe(&snapshot_at(9, 0, 90, 60));
        let reached = state.observe(&snapshot_at(9, 30, 90, 90));
        assert_eq!(reached.countdown_reminder.map(|r| r.session_id), Some(9));
    }

    #[test]
    fn reminds_to_rest_once_per_session() {
        let mut state = WatchState::default();
        assert_eq!(
            state
                .observe(&snapshot_at(7, 179, 0, 179))
                .long_session_minutes,
            None
        );
        assert_eq!(
            state
                .observe(&snapshot_at(7, 180, 0, 180))
                .long_session_minutes,
            Some(180)
        );
        assert_eq!(
            state
                .observe(&snapshot_at(7, 200, 0, 200))
                .long_session_minutes,
            None
        );
    }

    #[test]
    fn tray_updates_only_when_changed() {
        let mut state = WatchState::default();
        let first = state.observe(&snapshot_at(7, 0, 60, 30));
        assert_eq!(
            first.tray,
            Some((
                "Learnis · 正在学习 After Effects\n今天已学 00:30:00".into(),
                true
            ))
        );
        assert_eq!(state.observe(&snapshot_at(7, 0, 60, 30)).tray, None);

        let done = state.observe(&snapshot_at(7, 30, 60, 60)).tray.unwrap();
        assert!(done.0.ends_with("今天已学 01:00:00，目标已完成"));

        assert_eq!(
            state.observe(&idle()),
            Actions {
                tray: Some(("Learnis".into(), false)),
                ..Actions::default()
            }
        );
    }
}
