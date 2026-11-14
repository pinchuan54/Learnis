//! Learnis 桌面端核心。
//!
//! 系统相关能力（数据库、计时持久化、托盘、全局快捷键等）都放在这里，
//! 平台差异用 `cfg(target_os = ...)` 隔离，便于以后移植到 macOS / Linux。

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("启动 Learnis 失败");
}
