//! 学习计划：增删改查与每日基础分配。

use std::collections::HashMap;

use chrono::NaiveDate;
use rusqlite::{Connection, OptionalExtension, Row, Transaction, params};

use super::Ctx;
use super::allocation::{ALL_WEEKDAYS, distribute, study_days};
use super::corrections;
use super::model::{AllocationPreview, Plan, PlanInput, PlanSummary};
use crate::error::{AppError, AppResult};
use crate::time::{format_date, parse_date};

/// 可选的计划颜色（前端按名字映射到具体色值）
pub const COLORS: &[&str] = &[
    "blue", "purple", "pink", "red", "orange", "yellow", "green", "teal", "gray",
];

const MAX_NAME_CHARS: usize = 40;
const MAX_GOAL_CHARS: usize = 500;
const MAX_TOTAL_MINUTES: i64 = 100_000 * 60;
const MAX_RANGE_DAYS: i64 = 3660;
const NO_STUDY_DAYS: &str = "期限内没有勾选的学习日";

const SELECT_PLAN: &str = "SELECT id, name, goal, color, total_minutes, start_date, end_date, \
                           study_weekdays, archived, created_at, updated_at FROM plans";

fn map_plan(row: &Row) -> rusqlite::Result<Plan> {
    Ok(Plan {
        id: row.get(0)?,
        name: row.get(1)?,
        goal: row.get(2)?,
        color: row.get(3)?,
        total_minutes: row.get(4)?,
        start_date: row.get(5)?,
        end_date: row.get(6)?,
        study_weekdays: row.get(7)?,
        archived: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

/// 校验后的计划输入
struct Validated {
    name: String,
    goal: String,
    color: String,
    total_minutes: i64,
    start: NaiveDate,
    end: NaiveDate,
    weekdays: u8,
}

fn validate(input: &PlanInput) -> AppResult<Validated> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::invalid("请填写计划名称"));
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err(AppError::invalid(format!(
            "计划名称不能超过 {MAX_NAME_CHARS} 个字"
        )));
    }
    let goal = input.goal.trim().to_string();
    if goal.chars().count() > MAX_GOAL_CHARS {
        return Err(AppError::invalid(format!(
            "目标说明不能超过 {MAX_GOAL_CHARS} 个字"
        )));
    }
    if !COLORS.contains(&input.color.as_str()) {
        return Err(AppError::invalid("不支持的计划颜色"));
    }
    if input.total_minutes <= 0 {
        return Err(AppError::invalid("总时长必须大于 0"));
    }
    if input.total_minutes > MAX_TOTAL_MINUTES {
        return Err(AppError::invalid("总时长过大"));
    }
    if input.study_weekdays == 0 || input.study_weekdays > ALL_WEEKDAYS {
        return Err(AppError::invalid("请至少选择一个学习日"));
    }
    let start = parse_date(&input.start_date)?;
    let end = parse_date(&input.end_date)?;
    if end < start {
        return Err(AppError::invalid("期限不能早于开始日期"));
    }
    if (end - start).num_days() > MAX_RANGE_DAYS {
        return Err(AppError::invalid("期限不能超过 10 年"));
    }
    Ok(Validated {
        name,
        goal,
        color: input.color.clone(),
        total_minutes: input.total_minutes,
        start,
        end,
        weekdays: input.study_weekdays,
    })
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Plan> {
    conn.query_row(&format!("{SELECT_PLAN} WHERE id = ?1"), [id], map_plan)
        .optional()?
        .ok_or(AppError::NotFound("该计划"))
}

pub fn list(conn: &Connection, include_archived: bool) -> AppResult<Vec<Plan>> {
    let sql = if include_archived {
        format!("{SELECT_PLAN} ORDER BY archived, start_date, id")
    } else {
        format!("{SELECT_PLAN} WHERE archived = 0 ORDER BY start_date, id")
    };
    let mut stmt = conn.prepare(&sql)?;
    let plans = stmt
        .query_map([], map_plan)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(plans)
}

/// 计划列表 + 累计学习时长
pub fn list_summaries(
    conn: &Connection,
    ctx: &Ctx,
    include_archived: bool,
) -> AppResult<Vec<PlanSummary>> {
    let plans = list(conn, include_archived)?;
    let mut stmt = conn.prepare(
        "SELECT plan_id, SUM(MAX(COALESCE(end_at, ?1) - start_at, 0)) FROM sessions GROUP BY plan_id",
    )?;
    let studied: HashMap<i64, i64> = stmt
        .query_map([ctx.now_ms], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    // 累计时长 = 学习记录 + 手动修正
    let corrections = corrections::total_by_plan(conn)?;

    plans
        .into_iter()
        .map(|plan| {
            let start = parse_date(&plan.start_date)?;
            let end = parse_date(&plan.end_date)?;
            let study_day_count = study_days(start, end, plan.study_weekdays).len() as i64;
            let studied_seconds = (studied.get(&plan.id).copied().unwrap_or(0) / 1000
                + corrections.get(&plan.id).copied().unwrap_or(0))
            .max(0);
            Ok(PlanSummary {
                plan,
                studied_seconds,
                study_day_count,
            })
        })
        .collect()
}

/// 不落库，预览均分结果
pub fn preview(input: &PlanInput) -> AppResult<AllocationPreview> {
    let v = validate(input)?;
    let days = study_days(v.start, v.end, v.weekdays);
    if days.is_empty() {
        return Err(AppError::invalid(NO_STUDY_DAYS));
    }
    let parts = distribute(v.total_minutes, &days);
    Ok(AllocationPreview {
        study_day_count: days.len() as i64,
        min_daily_minutes: parts.iter().map(|(_, m)| *m).min().unwrap_or(0),
        max_daily_minutes: parts.iter().map(|(_, m)| *m).max().unwrap_or(0),
    })
}

pub fn create(conn: &mut Connection, ctx: &Ctx, input: &PlanInput) -> AppResult<Plan> {
    let v = validate(input)?;
    let days = study_days(v.start, v.end, v.weekdays);
    if days.is_empty() {
        return Err(AppError::invalid(NO_STUDY_DAYS));
    }

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO plans (name, goal, color, total_minutes, start_date, end_date, study_weekdays, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![
            v.name,
            v.goal,
            v.color,
            v.total_minutes,
            format_date(v.start),
            format_date(v.end),
            v.weekdays,
            ctx.now_ms
        ],
    )?;
    let id = tx.last_insert_rowid();
    insert_days(&tx, id, &distribute(v.total_minutes, &days))?;
    tx.commit()?;
    get(conn, id)
}

/// 编辑计划。只有总时长、日期或学习日变化时才重新分配：
/// 今天之前的基础分配保持不变，剩余时长重新均分到今天及以后的学习日；
/// 已有的调整（调入 / 调出）不受影响。
pub fn update(conn: &mut Connection, ctx: &Ctx, id: i64, input: &PlanInput) -> AppResult<Plan> {
    let v = validate(input)?;
    let old = get(conn, id)?;
    let allocation_changed = old.total_minutes != v.total_minutes
        || old.start_date != format_date(v.start)
        || old.end_date != format_date(v.end)
        || old.study_weekdays != v.weekdays;

    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE plans SET name = ?1, goal = ?2, color = ?3, total_minutes = ?4, start_date = ?5,
                end_date = ?6, study_weekdays = ?7, updated_at = ?8
         WHERE id = ?9",
        params![
            v.name,
            v.goal,
            v.color,
            v.total_minutes,
            format_date(v.start),
            format_date(v.end),
            v.weekdays,
            ctx.now_ms,
            id
        ],
    )?;
    if allocation_changed {
        reallocate(&tx, id, ctx.today, &v)?;
    }
    tx.commit()?;
    get(conn, id)
}

fn reallocate(tx: &Transaction, plan_id: i64, today: NaiveDate, v: &Validated) -> AppResult<()> {
    // 保留今天之前、且仍在新期限内的基础分配
    tx.execute(
        "DELETE FROM plan_days WHERE plan_id = ?1 AND (date >= ?2 OR date < ?3 OR date > ?4)",
        params![
            plan_id,
            format_date(today),
            format_date(v.start),
            format_date(v.end)
        ],
    )?;
    let frozen: i64 = tx.query_row(
        "SELECT COALESCE(SUM(base_minutes), 0) FROM plan_days WHERE plan_id = ?1",
        [plan_id],
        |row| row.get(0),
    )?;
    let remaining = (v.total_minutes - frozen).max(0);
    let from = v.start.max(today);
    let days = if from <= v.end {
        study_days(from, v.end, v.weekdays)
    } else {
        Vec::new()
    };
    if days.is_empty() && remaining > 0 {
        return Err(AppError::invalid(
            "期限内已经没有可分配的学习日，请延长期限或增加学习日",
        ));
    }
    insert_days(tx, plan_id, &distribute(remaining, &days))
}

fn insert_days(tx: &Transaction, plan_id: i64, parts: &[(NaiveDate, i64)]) -> AppResult<()> {
    let mut stmt =
        tx.prepare("INSERT INTO plan_days (plan_id, date, base_minutes) VALUES (?1, ?2, ?3)")?;
    for (date, minutes) in parts {
        stmt.execute(params![plan_id, format_date(*date), minutes])?;
    }
    Ok(())
}

pub fn set_archived(conn: &Connection, ctx: &Ctx, id: i64, archived: bool) -> AppResult<Plan> {
    let changed = conn.execute(
        "UPDATE plans SET archived = ?1, updated_at = ?2 WHERE id = ?3",
        params![archived, ctx.now_ms, id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("该计划"));
    }
    get(conn, id)
}

/// 最近计时过的未归档计划；从未计时则取第一个未归档计划（快捷键 / 托盘开始计时用）
pub fn last_used(conn: &Connection) -> AppResult<Option<Plan>> {
    let recent = conn
        .query_row(
            &format!(
                "{SELECT_PLAN} WHERE archived = 0 AND id = (
                    SELECT s.plan_id FROM sessions s JOIN plans p ON p.id = s.plan_id
                    WHERE p.archived = 0 ORDER BY s.start_at DESC LIMIT 1)"
            ),
            [],
            map_plan,
        )
        .optional()?;
    match recent {
        Some(plan) => Ok(Some(plan)),
        None => Ok(list(conn, false)?.into_iter().next()),
    }
}

/// 删除计划及其全部分配、调整和学习记录
pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let changed = conn.execute("DELETE FROM plans WHERE id = ?1", [id])?;
    if changed == 0 {
        return Err(AppError::NotFound("该计划"));
    }
    Ok(())
}

/// 读取某计划的全部基础分配（测试与调试用）
#[cfg(test)]
pub fn base_allocation(conn: &Connection, plan_id: i64) -> Vec<(String, i64)> {
    let mut stmt = conn
        .prepare("SELECT date, base_minutes FROM plan_days WHERE plan_id = ?1 ORDER BY date")
        .unwrap();
    stmt.query_map([plan_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}

#[cfg(test)]
pub(crate) fn sample_input(total_minutes: i64, start: &str, end: &str) -> PlanInput {
    PlanInput {
        name: "AE".into(),
        goal: String::new(),
        color: "blue".into(),
        total_minutes,
        start_date: start.into(),
        end_date: end.into(),
        study_weekdays: ALL_WEEKDAYS,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::testing::{conn, ctx_at};

    #[test]
    fn create_distributes_total_over_study_days() {
        let mut conn = conn();
        let ctx = ctx_at("2026-11-01", 9);
        let plan = create(
            &mut conn,
            &ctx,
            &sample_input(600, "2026-11-01", "2026-11-10"),
        )
        .unwrap();
        let days = base_allocation(&conn, plan.id);
        assert_eq!(days.len(), 10);
        assert!(days.iter().all(|(_, m)| *m == 60));
    }

    #[test]
    fn create_rejects_invalid_input() {
        let mut conn = conn();
        let ctx = ctx_at("2026-11-01", 9);
        let mut input = sample_input(600, "2026-11-10", "2026-11-01");
        assert!(create(&mut conn, &ctx, &input).is_err());
        input = sample_input(0, "2026-11-01", "2026-11-10");
        assert!(create(&mut conn, &ctx, &input).is_err());
        input = sample_input(600, "2026-11-01", "2026-11-10");
        input.name = "   ".into();
        assert!(create(&mut conn, &ctx, &input).is_err());
        // 2026-11-14 / 15 是周末，只勾选周一
        input = sample_input(600, "2026-11-14", "2026-11-15");
        input.study_weekdays = 0b000_0001;
        assert!(create(&mut conn, &ctx, &input).is_err());
    }

    #[test]
    fn update_keeps_past_allocation_and_redistributes_rest() {
        let mut conn = conn();
        let created = create(
            &mut conn,
            &ctx_at("2026-11-01", 9),
            &sample_input(600, "2026-11-01", "2026-11-10"),
        )
        .unwrap();
        // 11-06 时把总时长改成 900：前 5 天各 60 分钟保留，剩余 600 分到 11-06 ~ 11-10
        let input = sample_input(900, "2026-11-01", "2026-11-10");
        update(&mut conn, &ctx_at("2026-11-06", 9), created.id, &input).unwrap();
        let days = base_allocation(&conn, created.id);
        let past: i64 = days.iter().take(5).map(|(_, m)| m).sum();
        assert_eq!(past, 300);
        assert!(days.iter().skip(5).all(|(_, m)| *m == 120));
        assert_eq!(days.iter().map(|(_, m)| m).sum::<i64>(), 900);
    }

    #[test]
    fn update_without_allocation_change_keeps_days() {
        let mut conn = conn();
        let created = create(
            &mut conn,
            &ctx_at("2026-11-01", 9),
            &sample_input(601, "2026-11-01", "2026-11-10"),
        )
        .unwrap();
        let before = base_allocation(&conn, created.id);
        let mut input = sample_input(601, "2026-11-01", "2026-11-10");
        input.name = "After Effects".into();
        let updated = update(&mut conn, &ctx_at("2026-11-06", 9), created.id, &input).unwrap();
        assert_eq!(updated.name, "After Effects");
        assert_eq!(base_allocation(&conn, created.id), before);
    }

    #[test]
    fn preview_reports_daily_range() {
        let preview = preview(&sample_input(1000, "2026-11-01", "2026-11-03")).unwrap();
        assert_eq!(preview.study_day_count, 3);
        assert_eq!(preview.min_daily_minutes, 333);
        assert_eq!(preview.max_daily_minutes, 334);
    }

    #[test]
    fn archive_and_delete() {
        let mut conn = conn();
        let ctx = ctx_at("2026-11-01", 9);
        let plan = create(
            &mut conn,
            &ctx,
            &sample_input(600, "2026-11-01", "2026-11-10"),
        )
        .unwrap();
        assert!(set_archived(&conn, &ctx, plan.id, true).unwrap().archived);
        assert!(list(&conn, false).unwrap().is_empty());
        assert_eq!(list(&conn, true).unwrap().len(), 1);
        delete(&conn, plan.id).unwrap();
        assert!(base_allocation(&conn, plan.id).is_empty());
        assert!(matches!(get(&conn, plan.id), Err(AppError::NotFound(_))));
    }

    #[test]
    fn last_used_prefers_most_recent_session() {
        let mut conn = conn();
        let ctx = ctx_at("2026-11-01", 9);
        assert!(last_used(&conn).unwrap().is_none());
        let first = create(
            &mut conn,
            &ctx,
            &sample_input(600, "2026-11-01", "2026-11-10"),
        )
        .unwrap();
        let second = create(
            &mut conn,
            &ctx,
            &sample_input(600, "2026-11-02", "2026-11-10"),
        )
        .unwrap();
        // 没有计时记录时取第一个计划
        assert_eq!(last_used(&conn).unwrap().unwrap().id, first.id);
        crate::domain::sessions::start(&conn, &ctx, second.id).unwrap();
        assert_eq!(last_used(&conn).unwrap().unwrap().id, second.id);
        // 归档后不再选它
        set_archived(&conn, &ctx, second.id, true).unwrap();
        assert_eq!(last_used(&conn).unwrap().unwrap().id, first.id);
    }
}
