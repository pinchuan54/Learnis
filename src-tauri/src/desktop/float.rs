//! 悬浮窗：透明、置顶、不出现在任务栏、点它不抢走下面软件焦点的小窗口，显示计时、开始 / 暂停。
//!
//! - 用时才建、关掉就销毁，不用时不占内存；
//! - 和主窗口同一时间只出现一个：主窗口回到前台就关掉悬浮窗；
//! - 计时中把主窗口关到托盘或最小化时，按设置自动出现。
//!
//! 窗口的大小、位置和第一次显示都由悬浮窗页面自己处理（它知道内容多大、贴在哪条边），
//! 这里只负责建窗口和关窗口。

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

use super::tray;
use crate::db::Db;
use crate::domain::{sessions, settings};

pub const LABEL: &str = "float";

fn is_open<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.get_webview_window(LABEL).is_some()
}

/// 打开悬浮窗（已经开着就不动）。窗口先隐藏，页面排好版、摆好位置后自己显示
pub fn open<R: Runtime>(app: &AppHandle<R>) {
    if is_open(app) {
        return;
    }
    let built = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("float.html".into()))
        .title("Learnis 悬浮窗")
        .inner_size(160.0, 64.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focusable(false)
        .focused(false)
        .visible(false)
        .build();
    match built {
        Ok(_) => tray::set_float_open(app, true),
        Err(err) => eprintln!("打开悬浮窗失败：{err}"),
    }
}

/// 关掉悬浮窗并释放它占的内存
pub fn close<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.destroy();
        tray::set_float_open(app, false);
    }
}

/// 进入悬浮窗：收起主窗口、打开悬浮窗（主窗口顶栏的按钮、托盘、快捷键）
pub fn enter<R: Runtime>(app: &AppHandle<R>) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
    open(app);
}

/// 快捷键、托盘：开着就关，关着就进入
pub fn toggle<R: Runtime>(app: &AppHandle<R>) {
    if is_open(app) {
        close(app);
    } else {
        enter(app);
    }
}

/// 主窗口被关到托盘或最小化：计时中且开了「关掉主窗口时自动出现」就打开悬浮窗
pub fn main_window_left<R: Runtime>(app: &AppHandle<R>) {
    let Some(db) = app.try_state::<Db>() else {
        return;
    };
    let wanted = db
        .with(|conn| Ok(settings::get(conn)?.float_auto && sessions::running(conn)?.is_some()))
        .unwrap_or(false);
    if wanted {
        open(app);
    }
}
