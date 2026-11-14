//! Learnis 桌面端核心。
//!
//! - `db`：SQLite 连接与表结构迁移
//! - `time`：时区、日界线与跨天切分
//! - `domain`：计划分配、计时、调整、待办、设置等业务逻辑（与界面无关，配单元测试）
//! - `commands`：暴露给前端的命令
//! - `desktop`：托盘、全局快捷键、计时监视与通知（仅桌面端）
//!
//! 平台差异用 `cfg(desktop)` / `cfg(target_os = ...)` 隔离，便于以后移植到 macOS / Linux。

mod commands;
mod db;
#[cfg(desktop)]
mod desktop;
mod domain;
mod error;
mod time;

use tauri::Manager;

use crate::db::Db;
use crate::domain::{Ctx, adjustments, settings};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // 单实例必须最先注册：重复打开时直接唤起已有窗口
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            desktop::show_main_window(app);
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // 检查更新只由后端命令调用，前端不直接使用插件，所以不需要额外权限
        .plugin(tauri_plugin_updater::Builder::new().build())
        // 设置为「关闭到托盘」时，关闭窗口只是隐藏
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event
                && window.label() == "main"
                && desktop::close_to_tray(window.app_handle())
            {
                api.prevent_close();
                let _ = window.hide();
            }
        });

    builder
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let db = open_database(app.handle())?;
            app.manage(db);
            #[cfg(desktop)]
            desktop::setup(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_clock,
            commands::get_settings,
            commands::update_settings,
            commands::list_timezones,
            commands::list_plans,
            commands::get_plan,
            commands::preview_plan,
            commands::create_plan,
            commands::update_plan,
            commands::set_plan_archived,
            commands::delete_plan,
            commands::get_month,
            commands::get_day,
            commands::get_timer_status,
            commands::start_timer,
            commands::stop_timer,
            commands::add_session,
            commands::update_session,
            commands::delete_session,
            commands::list_pending,
            commands::get_movable_minutes,
            commands::adjust_day,
            commands::undo_adjustment,
            commands::resolve_pending_automatically,
            commands::create_todo,
            commands::update_todo,
            commands::delete_todo,
            commands::reorder_todos,
            commands::open_project_page,
            #[cfg(desktop)]
            commands::check_update,
            #[cfg(desktop)]
            commands::install_update,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Learnis 失败");
}

/// 打开应用数据目录下的数据库。开发版使用单独的文件，避免影响正式数据。
fn open_database(app: &tauri::AppHandle) -> Result<Db, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    let file = if cfg!(debug_assertions) {
        "learnis-dev.db"
    } else {
        "learnis.db"
    };
    let db = Db::open(&dir.join(file))?;

    // 启动时按「未达标默认处理方式」处理之前挂起的时长；失败不影响启动
    let resolved = db.with(|conn| {
        let default = settings::get(conn)?.shortfall_default;
        let ctx = Ctx::load(conn)?;
        adjustments::auto_resolve(conn, &ctx, default)
    });
    if let Err(err) = resolved {
        eprintln!("自动处理未达标时长失败：{err}");
    }
    Ok(db)
}
