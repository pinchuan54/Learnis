//! 前端可调用的命令。只做参数传递，业务逻辑都在 `domain` 中。
//!
//! 命令均为 async，在后台线程执行，不阻塞界面。

use serde_json::Value;
use tauri::{AppHandle, Runtime, State};

use crate::db::Db;
#[cfg(desktop)]
use crate::desktop;
use crate::domain::model::{
    AdjustRequest, Adjustment, AllocationPreview, Clock, DayDetail, MonthOverview,
    PendingShortfall, Plan, PlanInput, PlanSummary, Session, SessionInput, TimerStatus, Todo,
    TodoInput, TodoPatch,
};
use crate::domain::settings::Settings;
use crate::domain::{Ctx, adjustments, overview, plans, sessions, settings, todos};
use crate::error::{AppError, AppResult};
use crate::time::parse_date;

// ---------- 时间与设置 ----------

#[tauri::command]
pub async fn get_clock(db: State<'_, Db>) -> AppResult<Clock> {
    db.with(|conn| Ok(overview::clock(&Ctx::load(conn)?)))
}

#[tauri::command]
pub async fn get_settings(db: State<'_, Db>) -> AppResult<Settings> {
    db.with(|conn| settings::get(conn))
}

/// 更新设置。修改快捷键时先尝试注册，注册失败（格式错误或被占用）则不保存并恢复原快捷键。
#[tauri::command]
pub async fn update_settings<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, Db>,
    patch: Value,
) -> AppResult<Settings> {
    let new_hotkey = patch
        .get("toggleHotkey")
        .and_then(Value::as_str)
        .map(str::to_owned);
    let previous = db.with(|conn| settings::get(conn))?.toggle_hotkey;
    let hotkey_changed = new_hotkey
        .as_ref()
        .is_some_and(|hotkey| *hotkey != previous);

    #[cfg(desktop)]
    if let (true, Some(hotkey)) = (hotkey_changed, &new_hotkey)
        && let Err(err) = desktop::hotkey::register(&app, hotkey)
    {
        let _ = desktop::hotkey::register(&app, &previous);
        return Err(err);
    }

    let saved = db.with(|conn| settings::update(conn, &patch));
    #[cfg(desktop)]
    if saved.is_err() && hotkey_changed {
        let _ = desktop::hotkey::register(&app, &previous);
    }
    #[cfg(not(desktop))]
    let _ = (&app, hotkey_changed);
    saved
}

/// 可选的 IANA 时区列表
#[tauri::command]
pub async fn list_timezones() -> Vec<&'static str> {
    chrono_tz::TZ_VARIANTS.iter().map(|tz| tz.name()).collect()
}

// ---------- 计划 ----------

#[tauri::command]
pub async fn list_plans(db: State<'_, Db>, include_archived: bool) -> AppResult<Vec<PlanSummary>> {
    db.with(|conn| plans::list_summaries(conn, &Ctx::load(conn)?, include_archived))
}

#[tauri::command]
pub async fn get_plan(db: State<'_, Db>, id: i64) -> AppResult<Plan> {
    db.with(|conn| plans::get(conn, id))
}

#[tauri::command]
pub async fn preview_plan(input: PlanInput) -> AppResult<AllocationPreview> {
    plans::preview(&input)
}

#[tauri::command]
pub async fn create_plan(db: State<'_, Db>, input: PlanInput) -> AppResult<Plan> {
    db.with(|conn| {
        let ctx = Ctx::load(conn)?;
        plans::create(conn, &ctx, &input)
    })
}

#[tauri::command]
pub async fn update_plan(db: State<'_, Db>, id: i64, input: PlanInput) -> AppResult<Plan> {
    db.with(|conn| {
        let ctx = Ctx::load(conn)?;
        plans::update(conn, &ctx, id, &input)
    })
}

#[tauri::command]
pub async fn set_plan_archived(db: State<'_, Db>, id: i64, archived: bool) -> AppResult<Plan> {
    db.with(|conn| plans::set_archived(conn, &Ctx::load(conn)?, id, archived))
}

#[tauri::command]
pub async fn delete_plan(db: State<'_, Db>, id: i64) -> AppResult<()> {
    db.with(|conn| plans::delete(conn, id))
}

// ---------- 概览 ----------

#[tauri::command]
pub async fn get_month(db: State<'_, Db>, year: i32, month: u32) -> AppResult<MonthOverview> {
    db.with(|conn| overview::month(conn, &Ctx::load(conn)?, year, month))
}

#[tauri::command]
pub async fn get_day(db: State<'_, Db>, date: String) -> AppResult<DayDetail> {
    db.with(|conn| overview::day(conn, &Ctx::load(conn)?, &date))
}

// ---------- 计时与学习记录 ----------

#[tauri::command]
pub async fn get_timer_status(db: State<'_, Db>) -> AppResult<TimerStatus> {
    db.with(|conn| overview::timer_status(conn, &Ctx::load(conn)?))
}

#[tauri::command]
pub async fn start_timer(db: State<'_, Db>, plan_id: i64) -> AppResult<TimerStatus> {
    db.with(|conn| {
        let ctx = Ctx::load(conn)?;
        sessions::start(conn, &ctx, plan_id)?;
        overview::timer_status(conn, &ctx)
    })
}

#[tauri::command]
pub async fn stop_timer(db: State<'_, Db>) -> AppResult<TimerStatus> {
    db.with(|conn| {
        let ctx = Ctx::load(conn)?;
        sessions::stop(conn, &ctx)?;
        overview::timer_status(conn, &ctx)
    })
}

#[tauri::command]
pub async fn add_session(db: State<'_, Db>, input: SessionInput) -> AppResult<Session> {
    db.with(|conn| sessions::add_manual(conn, &Ctx::load(conn)?, &input))
}

#[tauri::command]
pub async fn update_session(db: State<'_, Db>, id: i64, input: SessionInput) -> AppResult<Session> {
    db.with(|conn| sessions::update(conn, &Ctx::load(conn)?, id, &input))
}

#[tauri::command]
pub async fn delete_session(db: State<'_, Db>, id: i64) -> AppResult<()> {
    db.with(|conn| sessions::delete(conn, id))
}

// ---------- 未达标与调整 ----------

#[tauri::command]
pub async fn list_pending(db: State<'_, Db>) -> AppResult<Vec<PendingShortfall>> {
    db.with(|conn| adjustments::pending(conn, &Ctx::load(conn)?))
}

#[tauri::command]
pub async fn get_movable_minutes(db: State<'_, Db>, plan_id: i64, date: String) -> AppResult<i64> {
    db.with(|conn| {
        let ctx = Ctx::load(conn)?;
        adjustments::movable_minutes(conn, &ctx, plan_id, parse_date(&date)?)
    })
}

#[tauri::command]
pub async fn adjust_day(db: State<'_, Db>, request: AdjustRequest) -> AppResult<Adjustment> {
    db.with(|conn| {
        let ctx = Ctx::load(conn)?;
        adjustments::adjust(conn, &ctx, &request, false)
    })
}

#[tauri::command]
pub async fn undo_adjustment(db: State<'_, Db>, id: i64) -> AppResult<()> {
    db.with(|conn| adjustments::undo(conn, id))
}

/// 按「未达标默认处理方式」自动处理挂起的时长（启动时和跨天时调用）
#[tauri::command]
pub async fn resolve_pending_automatically(db: State<'_, Db>) -> AppResult<usize> {
    db.with(|conn| {
        let default = settings::get(conn)?.shortfall_default;
        let ctx = Ctx::load(conn)?;
        adjustments::auto_resolve(conn, &ctx, default)
    })
}

// ---------- 待办 ----------

#[tauri::command]
pub async fn create_todo(db: State<'_, Db>, input: TodoInput) -> AppResult<Todo> {
    db.with(|conn| todos::create(conn, &Ctx::load(conn)?, &input))
}

#[tauri::command]
pub async fn update_todo(db: State<'_, Db>, id: i64, patch: TodoPatch) -> AppResult<Todo> {
    db.with(|conn| todos::update(conn, &Ctx::load(conn)?, id, &patch))
}

#[tauri::command]
pub async fn delete_todo(db: State<'_, Db>, id: i64) -> AppResult<()> {
    db.with(|conn| todos::delete(conn, id))
}

#[tauri::command]
pub async fn reorder_todos(db: State<'_, Db>, date: String, ids: Vec<i64>) -> AppResult<Vec<Todo>> {
    db.with(|conn| {
        let ctx = Ctx::load(conn)?;
        todos::reorder(conn, &ctx, &date, &ids)
    })
}

// ---------- 关于 ----------

/// 项目地址，取自 `Cargo.toml` 的 `repository`
const PROJECT_URL: &str = env!("CARGO_PKG_REPOSITORY");

/// 用系统默认浏览器打开项目地址。地址写死在后端，前端不能借此打开任意链接。
#[tauri::command]
pub async fn open_project_page() -> AppResult<()> {
    open::that_detached(PROJECT_URL)
        .map_err(|err| AppError::Internal(format!("无法打开浏览器：{err}")))
}

#[cfg(test)]
mod tests {
    use super::PROJECT_URL;

    #[test]
    fn project_url_points_to_github_repository() {
        assert_eq!(PROJECT_URL, "https://github.com/pinchuan54/Learnis");
    }
}
