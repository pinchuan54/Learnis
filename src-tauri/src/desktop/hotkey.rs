//! 全局快捷键：在任何程序（包括 AE）前台时都能开始 / 暂停计时。

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use super::toggle_timer;
use crate::db::Db;
use crate::domain::settings;
use crate::error::{AppError, AppResult};

/// 校验快捷键格式，例如 `Ctrl+Shift+F12`
pub fn parse(value: &str) -> AppResult<Shortcut> {
    value
        .trim()
        .parse::<Shortcut>()
        .map_err(|_| AppError::invalid(format!("无法识别的快捷键：{value}")))
}

/// 注册快捷键（替换之前注册的）
pub fn register<R: Runtime>(app: &AppHandle<R>, value: &str) -> AppResult<()> {
    let shortcut = parse(value)?;
    let manager = app.global_shortcut();
    manager
        .unregister_all()
        .map_err(|err| AppError::Internal(format!("注销快捷键失败：{err}")))?;
    manager
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_timer(app);
            }
        })
        .map_err(|err| {
            AppError::conflict(format!(
                "快捷键 {value} 注册失败，可能已被其他程序占用（{err}）"
            ))
        })
}

/// 按设置中的快捷键注册
pub fn register_from_settings<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    let hotkey = app
        .state::<Db>()
        .with(|conn| settings::get(conn))?
        .toggle_hotkey;
    register(app, &hotkey)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_formats() {
        assert!(parse("Ctrl+Shift+F12").is_ok());
        assert!(parse("ctrl+alt+space").is_ok());
        assert!(parse("Alt+Shift+K").is_ok());
        assert!(parse("Ctrl+").is_err());
        assert!(parse("Hyper+Q").is_err());
    }
}
