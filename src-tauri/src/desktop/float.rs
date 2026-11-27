//! 悬浮窗：透明、置顶、不出现在任务栏、点它不抢走下面软件焦点的小窗口，显示计时、开始 / 暂停。
//!
//! - 用时才建、关掉就销毁，不用时不占内存；
//! - 可以和主窗口同时出现；点主窗口顶栏的按钮进入时收起主窗口；
//! - 计时中把主窗口关到托盘或最小化时，按设置自动出现；
//! - 开关时发 `float-open` 事件（true / false），主窗口顶栏的按钮据此高亮。
//!
//! 窗口的大小、位置和第一次显示都由悬浮窗页面自己处理（它知道内容多大、贴在哪条边），
//! 这里只负责建窗口、关窗口和点击穿透。
//!
//! 点击穿透（#64）：窗口比看得见的形状大一圈（投影、悬停放大、按钮展开的余量），鼠标在形状外面时
//! 页面打开穿透，点击直接落到下面的软件。穿透时页面收不到鼠标，由这里每隔一会儿看一眼鼠标，
//! 在窗口范围里就把位置发给页面，页面判断回到了形状上再关掉穿透。

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::thread;
use std::time::Duration;

use tauri::{
    AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use super::tray;
use crate::db::Db;
use crate::domain::{sessions, settings};

pub const LABEL: &str = "float";
const OPEN_EVENT: &str = "float-open";
/// 穿透时鼠标在窗口范围里的位置（窗口里的物理像素）
const CURSOR_EVENT: &str = "float-cursor";
const CURSOR_POLL: Duration = Duration::from_millis(16);

/// 穿透开着
static PASSTHROUGH: AtomicBool = AtomicBool::new(false);
/// 每建一次悬浮窗加一，旧窗口的看鼠标线程见到变了就停
static GENERATION: AtomicU64 = AtomicU64::new(0);

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
        Ok(window) => {
            watch_cursor(window);
            changed(app, true);
        }
        Err(err) => eprintln!("打开悬浮窗失败：{err}"),
    }
}

/// 页面按鼠标在不在形状上开关点击穿透
pub fn set_passthrough<R: Runtime>(app: &AppHandle<R>, on: bool) {
    if let Some(window) = app.get_webview_window(LABEL)
        && window.set_ignore_cursor_events(on).is_ok()
    {
        PASSTHROUGH.store(on, Ordering::Relaxed);
    }
}

/// 穿透时看着鼠标，进了窗口范围就把位置发给页面；窗口没了或换了新窗口就停
fn watch_cursor<R: Runtime>(window: WebviewWindow<R>) {
    let generation = GENERATION.fetch_add(1, Ordering::Relaxed) + 1;
    PASSTHROUGH.store(false, Ordering::Relaxed);
    thread::spawn(move || {
        let mut last = None;
        while GENERATION.load(Ordering::Relaxed) == generation {
            thread::sleep(CURSOR_POLL);
            if !PASSTHROUGH.load(Ordering::Relaxed) {
                last = None;
                continue;
            }
            if window.app_handle().get_webview_window(LABEL).is_none() {
                break;
            }
            let (Ok(cursor), Ok(origin), Ok(size)) = (
                window.cursor_position(),
                window.inner_position(),
                window.inner_size(),
            ) else {
                continue;
            };
            let at = (
                cursor.x - f64::from(origin.x),
                cursor.y - f64::from(origin.y),
            );
            let inside = (0.0..f64::from(size.width)).contains(&at.0)
                && (0.0..f64::from(size.height)).contains(&at.1);
            if inside && last != Some(at) {
                let _ = window.emit_to(LABEL, CURSOR_EVENT, at);
            }
            last = Some(at);
        }
    });
}

/// 托盘的勾、主窗口顶栏的按钮跟着悬浮窗开关
fn changed<R: Runtime>(app: &AppHandle<R>, open: bool) {
    tray::set_float_open(app, open);
    let _ = app.emit(OPEN_EVENT, open);
}

/// 关掉悬浮窗并释放它占的内存
pub fn close<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.destroy();
        changed(app, false);
    }
}

/// 进入悬浮窗（主窗口顶栏的按钮）：打开悬浮窗、收起主窗口
pub fn enter<R: Runtime>(app: &AppHandle<R>) {
    open(app);
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
}

/// 托盘、快捷键：开着就关，关着就打开（主窗口不动）
pub fn toggle<R: Runtime>(app: &AppHandle<R>) {
    if is_open(app) {
        close(app);
    } else {
        open(app);
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
