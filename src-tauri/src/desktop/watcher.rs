//! 计时监视：每秒检查一次正在进行的计时。
//!
//! - 更新托盘提示（显示正在学的计划和今天已学时长）；
//! - 倒计时归零且设置为「自动暂停」时暂停计时并发通知；
//! - 单次计时超过设定时长时提醒休息。
//!
//! 在后台线程运行，窗口隐藏到托盘时依然有效。

use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use chrono::Utc;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use super::{TIMER_CHANGED_EVENT, notify, tray};
use crate::db::Db;
use crate::domain::settings::{CountdownEnd, Settings};
use crate::domain::{Ctx, overview, plans, sessions, settings};
use crate::error::AppResult;
use crate::time::resolve_timezone;

/// 针对当前这一次计时的提醒状态
#[derive(Default)]
struct WatchState {
    session_id: Option<i64>,
    /// 开始时今天的目标还没完成（已经超额后再开始的计时不自动暂停）
    started_below_target: bool,
    countdown_handled: bool,
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
    status: crate::domain::model::TimerStatus,
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

fn format_minutes(minutes: i64) -> String {
    match (minutes / 60, minutes % 60) {
        (0, m) => format!("{m} 分钟"),
        (h, 0) => format!("{h} 小时"),
        (h, m) => format!("{h} 小时 {m} 分钟"),
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
    let Ok(mut guard) = STATE.lock() else {
        return;
    };
    let state = guard.get_or_insert_with(WatchState::default);

    let running = snapshot.status.running.as_ref();
    let tooltip = match (running, &snapshot.status.plan_today) {
        (Some(session), Some(progress)) => {
            if state.session_id != Some(session.id) {
                state.session_id = Some(session.id);
                state.started_below_target =
                    progress.studied_seconds < progress.target_minutes * 60;
                state.countdown_handled = false;
                state.long_session_notified = false;
            }
            let name = snapshot.plan_name.as_deref().unwrap_or("计划");
            let target_seconds = progress.target_minutes * 60;

            // 倒计时归零：自动暂停
            if snapshot.settings.countdown_end == CountdownEnd::Pause
                && state.started_below_target
                && !state.countdown_handled
                && target_seconds > 0
                && progress.studied_seconds >= target_seconds
            {
                state.countdown_handled = true;
                let stopped = db.with(|conn| {
                    let ctx = Ctx::load(conn)?;
                    sessions::stop(conn, &ctx)
                });
                if stopped.is_ok() {
                    notify(
                        app,
                        "今日目标已完成",
                        &format!(
                            "{name} 今天的 {} 已经学完，计时已自动暂停",
                            format_minutes(progress.target_minutes)
                        ),
                    );
                    let _ = app.emit(TIMER_CHANGED_EVENT, ());
                }
            }

            // 长时间计时：提醒休息
            let limit = snapshot.settings.long_session_minutes;
            let elapsed_minutes = (snapshot.status.now_ms - session.start_at) / 60_000;
            if limit > 0 && elapsed_minutes >= limit && !state.long_session_notified {
                state.long_session_notified = true;
                notify(
                    app,
                    "休息一下吧",
                    &format!(
                        "已经连续计时 {}，起来活动活动再继续",
                        format_minutes(elapsed_minutes)
                    ),
                );
            }

            format!(
                "Learnis · 正在学习 {name}\n今天已学 {}",
                format_clock(progress.studied_seconds)
            )
        }
        _ => {
            state.session_id = None;
            "Learnis".to_string()
        }
    };

    let is_running = running.is_some();
    if tooltip != state.last_tooltip || state.last_running != Some(is_running) {
        tray::update(app, &tooltip, is_running);
        state.last_tooltip = tooltip;
        state.last_running = Some(is_running);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_clock_and_minutes() {
        assert_eq!(format_clock(3725), "01:02:05");
        assert_eq!(format_clock(-3), "00:00:00");
        assert_eq!(format_minutes(45), "45 分钟");
        assert_eq!(format_minutes(120), "2 小时");
        assert_eq!(format_minutes(135), "2 小时 15 分钟");
    }
}
