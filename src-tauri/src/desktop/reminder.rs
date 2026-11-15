//! 倒计时归零提醒：今天的目标学完时提醒，由用户选择继续学习或暂停计时。
//! 计时从不自动停下，没有用户同意就不暂停（#28）。
//!
//! - 界面里弹出提醒面板，等用户选择；窗口隐藏在托盘时也会准备好，打开窗口就能看到；
//! - 窗口不在前台时再发系统通知并闪烁任务栏按钮。Windows 上的通知带提示音、
//!   停留在屏幕上直到处理，并带「继续学习 / 暂停计时」按钮。

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, UserAttentionType};

use super::watcher::format_minutes;
use super::{emit_timer_changed, main_window_focused};
use crate::db::Db;
use crate::domain::{Ctx, sessions};
use crate::error::AppResult;

/// 提醒出现或被处理后通知前端刷新
pub const COUNTDOWN_REMINDER_EVENT: &str = "countdown-reminder";

/// 等待用户处理的归零提醒
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CountdownReminder {
    /// 提醒针对的那次计时
    pub session_id: i64,
    pub plan_name: String,
    pub target_minutes: i64,
}

static PENDING: Mutex<Option<CountdownReminder>> = Mutex::new(None);

/// 当前等待处理的提醒
pub fn pending() -> Option<CountdownReminder> {
    PENDING.lock().ok().and_then(|guard| guard.clone())
}

/// 按条件清除等待中的提醒，返回是否清除了
fn clear_pending_if(condition: impl FnOnce(&CountdownReminder) -> bool) -> bool {
    let Ok(mut guard) = PENDING.lock() else {
        return false;
    };
    if guard.as_ref().is_some_and(condition) {
        *guard = None;
        return true;
    }
    false
}

/// 发出提醒。会调用窗口与通知接口，不能在持有其他锁时调用。
pub fn show<R: Runtime>(app: &AppHandle<R>, reminder: CountdownReminder) {
    if let Ok(mut guard) = PENDING.lock() {
        *guard = Some(reminder.clone());
    }
    let _ = app.emit(COUNTDOWN_REMINDER_EVENT, ());

    // 窗口在前台时界面里的提醒面板已经足够
    if main_window_focused(app) {
        return;
    }
    request_attention(app);
    let body = format!(
        "{} 今天的 {}已经学完，计时还在继续",
        reminder.plan_name,
        format_minutes(reminder.target_minutes)
    );
    notify_with_choices(app, reminder.session_id, "今天的目标完成了", &body);
}

/// 提醒针对的计时已经结束（或换了一次计时）时收起提醒
pub fn dismiss_stale<R: Runtime>(app: &AppHandle<R>, running_session: Option<i64>) {
    if clear_pending_if(|reminder| Some(reminder.session_id) != running_session) {
        let _ = app.emit(COUNTDOWN_REMINDER_EVENT, ());
    }
}

/// 用户处理提醒：`pause` 为真时暂停提醒针对的那次计时，否则继续学习
pub fn answer<R: Runtime>(app: &AppHandle<R>, session_id: i64, pause: bool) -> AppResult<()> {
    clear_pending_if(|reminder| reminder.session_id == session_id);
    let stopped = pause && {
        let db = app.state::<Db>();
        db.with(|conn| {
            let ctx = Ctx::load(conn)?;
            sessions::stop_if_running(conn, &ctx, session_id)
        })?
    };
    let _ = app.emit(COUNTDOWN_REMINDER_EVENT, ());
    if stopped {
        emit_timer_changed(app);
    }
    Ok(())
}

/// 窗口没有隐藏时闪烁任务栏按钮，切到窗口后自动停止
fn request_attention<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main")
        && window.is_visible().unwrap_or(false)
    {
        let _ = window.request_user_attention(Some(UserAttentionType::Informational));
    }
}

#[cfg(windows)]
const ACTION_CONTINUE: &str = "continue";
#[cfg(windows)]
const ACTION_PAUSE: &str = "pause";

/// Windows：带提示音、停留在屏幕上直到处理、带「继续学习 / 暂停计时」按钮的通知。
/// 通知插件不支持这些选项，所以直接使用它底层的 notify-rust。
#[cfg(windows)]
fn notify_with_choices<R: Runtime>(app: &AppHandle<R>, session_id: i64, title: &str, body: &str) {
    use notify_rust::{Notification, NotificationResponse, Timeout, Urgency};

    let mut toast = Notification::new();
    toast
        .summary(title)
        .body(body)
        .action(ACTION_CONTINUE, "继续学习")
        .action(ACTION_PAUSE, "暂停计时")
        .sound_name("Reminder")
        // 长时间显示；Critical 对应 Windows 的提醒场景，停留在屏幕上直到用户处理
        .timeout(Timeout::Never)
        .urgency(Urgency::Critical);
    if let Some(app_id) = installed_app_id(app) {
        toast.app_id(&app_id);
    }

    let handle = match toast.show() {
        Ok(handle) => handle,
        Err(err) => {
            // 界面里的提醒面板和任务栏闪烁仍然有效
            eprintln!("发送归零提醒通知失败：{err}");
            return;
        }
    };
    let app = app.clone();
    let spawned = std::thread::Builder::new()
        .name("countdown-reminder".into())
        .spawn(move || {
            let _ = handle.wait_for_response(|response: &NotificationResponse| {
                let pause = match response {
                    NotificationResponse::Action(action) => action == ACTION_PAUSE,
                    // 点通知本身：打开窗口，在界面里选择
                    NotificationResponse::Default => {
                        super::show_main_window(&app);
                        return;
                    }
                    // 关掉通知视为继续学习
                    _ => false,
                };
                if let Err(err) = answer(&app, session_id, pause) {
                    super::notify(&app, "无法暂停计时", &err.to_string());
                }
            });
        });
    if let Err(err) = spawned {
        eprintln!("等待归零提醒通知的响应失败：{err}");
    }
}

/// 安装版用应用标识显示通知（安装程序已在开始菜单快捷方式里登记）；
/// 开发构建没有登记，返回 `None`，由 notify-rust 借用 PowerShell 的标识。与通知插件的做法一致。
#[cfg(windows)]
fn installed_app_id<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    use std::path::Path;

    let exe = tauri::utils::platform::current_exe().ok()?;
    let dir = exe.parent()?;
    let dev_build = ["debug", "release"]
        .iter()
        .any(|profile| dir.ends_with(Path::new("target").join(profile)));
    (!dev_build).then(|| app.config().identifier.clone())
}

/// 其他平台：普通系统通知，在界面里选择
#[cfg(not(windows))]
fn notify_with_choices<R: Runtime>(app: &AppHandle<R>, _session_id: i64, title: &str, body: &str) {
    super::notify(app, title, &format!("{body}，打开 Learnis 可以暂停"));
}
