//! 开机自启与静默启动。
//!
//! - 开机自启用官方插件登记到系统（Windows 写注册表启动项：有管理员权限时登记给所有用户，
//!   否则只登记给当前用户），登记的命令行带上 [`AUTOSTART_ARG`]，用来区分「开机自启」和「手动打开」；
//! - 登记的是程序路径，换目录重装后会失效，所以每次启动按当前路径重新登记；
//! - 主窗口在配置里默认隐藏，启动时由这里决定是否显示：
//!   只有「开机自启 + 打开了静默启动」才留在托盘，手动打开总是显示窗口；
//! - 安装更新后，安装器会带着原来的启动参数重新打开 Learnis，
//!   所以更新前留一个记号，让更新后的这次启动照常显示窗口。

use std::path::PathBuf;

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_autostart::ManagerExt;

use super::show_main_window;
use crate::db::Db;
use crate::domain::settings;
use crate::error::{AppError, AppResult};

/// 开机自启时附带的启动参数
pub const AUTOSTART_ARG: &str = "--autostart";

/// 「下次启动显示窗口」记号文件，放在应用数据目录
const SHOW_ONCE_FILE: &str = "show-window-on-next-start";

/// 开机自启插件。开发版用另一个启动项名称，调试时不会覆盖正式版的登记。
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    let name = if cfg!(debug_assertions) {
        "Learnis Dev"
    } else {
        "Learnis"
    };
    tauri_plugin_autostart::Builder::new()
        .app_name(name)
        .arg(AUTOSTART_ARG)
        .build()
}

/// 系统里是否已登记开机自启
pub fn autostart_enabled<R: Runtime>(app: &AppHandle<R>) -> AppResult<bool> {
    app.autolaunch()
        .is_enabled()
        .map_err(|err| AppError::Internal(format!("读取开机自启状态失败：{err}")))
}

/// 打开或关闭开机自启，返回设置后系统里的实际状态
pub fn set_autostart<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> AppResult<bool> {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    result.map_err(|err| {
        let action = if enabled { "打开" } else { "关闭" };
        AppError::Internal(format!("{action}开机自启失败：{err}"))
    })?;
    autostart_enabled(app)
}

/// 已开启开机自启时，按当前程序路径重新登记一次。
/// 系统判断「已开启」只看登记在不在、不核对路径，换目录重装后开关亮着、开机却不启动。
pub fn refresh_autostart<R: Runtime>(app: &AppHandle<R>) {
    if autostart_enabled(app).unwrap_or(false)
        && let Err(err) = set_autostart(app, true)
    {
        eprintln!("重新登记开机自启失败：{err}");
    }
}

/// 启动时是否只留在托盘、不显示窗口
fn start_hidden(by_autostart: bool, silent_start: bool, show_once: bool) -> bool {
    by_autostart && silent_start && !show_once
}

/// 启动时按设置显示主窗口，或只留在托盘
pub fn show_main_window_on_launch<R: Runtime>(app: &AppHandle<R>) {
    let by_autostart = std::env::args().any(|arg| arg == AUTOSTART_ARG);
    let silent_start = app
        .try_state::<Db>()
        .and_then(|db| db.with(|conn| settings::get(conn)).ok())
        .is_some_and(|settings| settings.silent_start);
    let show_once = take_show_once(app);
    if !start_hidden(by_autostart, silent_start, show_once) {
        show_main_window(app);
    }
}

/// 让下一次启动照常显示窗口（安装更新、重启前调用）
pub fn show_window_on_next_start<R: Runtime>(app: &AppHandle<R>) {
    if let Some(path) = show_once_path(app)
        && let Err(err) = std::fs::write(&path, b"")
    {
        eprintln!("写入启动记号失败：{err}");
    }
}

/// 读取并清除「下次启动显示窗口」记号
fn take_show_once<R: Runtime>(app: &AppHandle<R>) -> bool {
    show_once_path(app).is_some_and(|path| std::fs::remove_file(path).is_ok())
}

fn show_once_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(SHOW_ONCE_FILE))
}

#[cfg(test)]
mod tests {
    use super::start_hidden;

    #[test]
    fn only_silent_autostart_stays_in_tray() {
        assert!(start_hidden(true, true, false));
    }

    #[test]
    fn manual_launch_always_shows_window() {
        assert!(!start_hidden(false, true, false));
        assert!(!start_hidden(false, false, false));
    }

    #[test]
    fn autostart_without_silent_start_shows_window() {
        assert!(!start_hidden(true, false, false));
    }

    #[test]
    fn relaunch_after_update_shows_window() {
        assert!(!start_hidden(true, true, true));
    }
}
