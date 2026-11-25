//! 全局快捷键：在任何程序（包括 AE）前台时都能开始 / 暂停计时、显示 / 隐藏悬浮窗。

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use super::{float, toggle_timer};
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

/// 快捷键按下时做的事
type Action<R> = fn(&AppHandle<R>);

/// 注册两个快捷键（替换之前注册的）：开始 / 暂停计时、显示 / 隐藏悬浮窗
pub fn register<R: Runtime>(app: &AppHandle<R>, toggle: &str, float: &str) -> AppResult<()> {
    let toggle_shortcut = parse(toggle)?;
    let float_shortcut = parse(float)?;
    if toggle_shortcut == float_shortcut {
        return Err(AppError::invalid(
            "悬浮窗的快捷键不能和开始 / 暂停计时的快捷键相同",
        ));
    }
    let manager = app.global_shortcut();
    manager
        .unregister_all()
        .map_err(|err| AppError::Internal(format!("注销快捷键失败：{err}")))?;
    let actions: [(Shortcut, &str, Action<R>); 2] = [
        (toggle_shortcut, toggle, toggle_timer::<R>),
        (float_shortcut, float, float::toggle::<R>),
    ];
    for (shortcut, value, action) in actions {
        manager
            .on_shortcut(shortcut, move |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    action(app);
                }
            })
            .map_err(|err| {
                AppError::conflict(format!(
                    "快捷键 {value} 注册失败，可能已被其他程序占用（{err}）"
                ))
            })?;
    }
    Ok(())
}

/// 按设置中的快捷键注册
pub fn register_from_settings<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    let settings = app.state::<Db>().with(|conn| settings::get(conn))?;
    register(app, &settings.toggle_hotkey, &settings.float_hotkey)
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
