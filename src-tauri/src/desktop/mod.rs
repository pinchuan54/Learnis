//! 桌面端系统集成：托盘、全局快捷键、悬浮窗、计时监视与系统通知、倒计时归零提醒、关闭到托盘、开机自启、检查更新。

pub mod float;
pub mod hotkey;
pub mod reminder;
pub mod startup;
mod tray;
pub mod updater;
mod watcher;

use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;

use crate::db::Db;
use crate::domain::{Ctx, plans, sessions, settings};
use crate::error::AppResult;

/// 计时状态在界面之外发生变化（托盘、快捷键、在归零提醒的通知里暂停）时通知前端刷新
pub const TIMER_CHANGED_EVENT: &str = "timer-changed";

pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // 主窗口在配置里默认隐藏，先决定是否显示，避免静默启动时窗口闪一下
    startup::show_main_window_on_launch(app);
    startup::refresh_autostart(app);
    tray::create(app)?;
    if let Err(err) = hotkey::register_from_settings(app) {
        eprintln!("注册全局快捷键失败：{err}");
    }
    watcher::spawn(app.clone());
    Ok(())
}

/// 显示并聚焦主窗口（悬浮窗开着就照旧开着）
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// 主窗口当前是否在前台（在前台时不必再弹系统通知）
fn main_window_focused<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.get_webview_window("main")
        .map(|window| window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false))
        .unwrap_or(false)
}

pub fn notify<R: Runtime>(app: &AppHandle<R>, title: &str, body: &str) {
    if let Err(err) = app.notification().builder().title(title).body(body).show() {
        eprintln!("发送系统通知失败：{err}");
    }
}

/// 通知前端刷新，并立即刷新托盘
pub fn emit_timer_changed<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit(TIMER_CHANGED_EVENT, ());
    watcher::refresh_now(app);
}

/// 关闭窗口时是否缩到托盘
pub fn close_to_tray<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.try_state::<Db>()
        .and_then(|db| db.with(|conn| settings::get(conn)).ok())
        .map(|settings| settings.close_to_tray)
        .unwrap_or(false)
}

enum Toggled {
    Started(String),
    Stopped,
    NoPlan,
}

/// 切换计时：正在计时则暂停，否则开始最近使用的计划（托盘与快捷键共用）
pub fn toggle_timer<R: Runtime>(app: &AppHandle<R>) {
    let db = app.state::<Db>();
    let result: AppResult<Toggled> = db.with(|conn| {
        let ctx = Ctx::load(conn)?;
        if sessions::running(conn)?.is_some() {
            sessions::stop(conn, &ctx)?;
            return Ok(Toggled::Stopped);
        }
        match plans::last_used(conn)? {
            Some(plan) => {
                sessions::start(conn, &ctx, plan.id)?;
                Ok(Toggled::Started(plan.name))
            }
            None => Ok(Toggled::NoPlan),
        }
    });

    let quiet = main_window_focused(app);
    match result {
        Ok(Toggled::Started(name)) if !quiet => {
            notify(app, "开始计时", &format!("正在学习：{name}"))
        }
        Ok(Toggled::Stopped) if !quiet => notify(app, "已暂停计时", "随时按快捷键继续"),
        Ok(Toggled::NoPlan) => show_main_window(app),
        Err(err) => notify(app, "无法切换计时", &err.to_string()),
        _ => {}
    }
    emit_timer_changed(app);
}
