//! 系统托盘：显示窗口、开始 / 暂停计时、退出；悬停提示当前计时。

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime};

use super::{show_main_window, toggle_timer};

const TRAY_ID: &str = "learnis";

/// 托盘菜单中需要动态更新文字的项
pub struct TrayItems<R: Runtime> {
    toggle: MenuItem<R>,
}

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "打开 Learnis", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "开始计时", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出 Learnis", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &toggle, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Learnis")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "toggle" => toggle_timer(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;

    app.manage(TrayItems { toggle });
    Ok(())
}

/// 隐藏托盘图标。进程被直接结束（例如安装更新）前调用，避免残留图标。
pub fn hide<R: Runtime>(app: &AppHandle<R>) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_visible(false);
    }
}

/// 更新悬停提示与「开始 / 暂停」菜单文字
pub fn update<R: Runtime>(app: &AppHandle<R>, tooltip: &str, running: bool) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(tooltip));
    }
    if let Some(items) = app.try_state::<TrayItems<R>>() {
        let _ = items.toggle.set_text(if running {
            "暂停计时"
        } else {
            "开始计时"
        });
    }
}
