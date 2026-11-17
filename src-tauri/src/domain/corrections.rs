//! 手动修正：在计时器上拖动调整的学习时长（#36）。
//!
//! 拖动表示「多学了 / 少学了多少」，不改学习记录的起止时间，而是给计划当天记一笔修正。
//! 每个计划每天只有一笔净值（秒，可正可负），多次调整累加到同一行，净值为 0 时删除这一行。
//! 统计学习时长时，修正与学习记录相加（见 [`super::sessions::studied_by_plan_day`]）。

use std::collections::HashMap;

use chrono::NaiveDate;
use rusqlite::{Connection, OptionalExtension, params};

use super::Ctx;
use super::model::Correction;
use super::{plans, sessions};
use crate::error::{AppError, AppResult};
use crate::time::{day_start_ms, format_date, parse_date};

/// `[from, to]` 日期范围内，各计划每天的手动修正（秒）
pub fn by_plan_day(
    conn: &Connection,
    from: NaiveDate,
    to: NaiveDate,
) -> AppResult<HashMap<(i64, NaiveDate), i64>> {
    let mut stmt = conn
        .prepare("SELECT plan_id, date, seconds FROM corrections WHERE date BETWEEN ?1 AND ?2")?;
    let rows = stmt.query_map(params![format_date(from), format_date(to)], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?;
    let mut map = HashMap::new();
    for row in rows {
        let (plan_id, date, seconds) = row?;
        map.insert((plan_id, parse_date(&date)?), seconds);
    }
    Ok(map)
}

/// 各计划累计的手动修正（秒）
pub fn total_by_plan(conn: &Connection) -> AppResult<HashMap<i64, i64>> {
    let mut stmt =
        conn.prepare("SELECT plan_id, SUM(seconds) FROM corrections GROUP BY plan_id")?;
    let totals = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(totals)
}

/// 某天的手动修正，按计划排序
pub fn list_on(conn: &Connection, date: NaiveDate) -> AppResult<Vec<Correction>> {
    let mut stmt = conn.prepare(
        "SELECT plan_id, date, seconds FROM corrections WHERE date = ?1 ORDER BY plan_id",
    )?;
    let list = stmt
        .query_map([format_date(date)], |row| {
            Ok(Correction {
                plan_id: row.get(0)?,
                date: row.get(1)?,
                seconds: row.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(list)
}

fn get(conn: &Connection, plan_id: i64, date: NaiveDate) -> AppResult<i64> {
    Ok(conn
        .query_row(
            "SELECT seconds FROM corrections WHERE plan_id = ?1 AND date = ?2",
            params![plan_id, format_date(date)],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or(0))
}

/// 给计划今天记一笔修正，返回修正后的当天净值。
///
/// 今天合计（学习记录 + 修正）会被限制在 0 到今天已经过去的时长之间：界面上拖到边界会停住，
/// 这里再兜一次底，避免界面和后端的时间有细微差别时报错。
pub fn add_today(conn: &Connection, ctx: &Ctx, plan_id: i64, seconds: i64) -> AppResult<i64> {
    let plan = plans::get(conn, plan_id)?;
    if plan.archived {
        return Err(AppError::invalid("计划已归档，不能修改学习时长"));
    }
    let today = ctx.today;
    let studied = sessions::studied_by_plan_day(conn, ctx, today, today)?
        .get(&(plan_id, today))
        .copied()
        .unwrap_or(0);
    let elapsed = (ctx.now_ms - day_start_ms(today, ctx.tz)) / 1000;
    let total = (studied + seconds).clamp(0, elapsed.max(studied));
    let applied = total - studied;
    let next = get(conn, plan_id, today)? + applied;
    set(conn, ctx, plan_id, today, next)?;
    Ok(next)
}

/// 删除某天的手动修正（当日记录里的「删除」）
pub fn clear(conn: &Connection, plan_id: i64, date: NaiveDate) -> AppResult<()> {
    conn.execute(
        "DELETE FROM corrections WHERE plan_id = ?1 AND date = ?2",
        params![plan_id, format_date(date)],
    )?;
    Ok(())
}

fn set(conn: &Connection, ctx: &Ctx, plan_id: i64, date: NaiveDate, seconds: i64) -> AppResult<()> {
    if seconds == 0 {
        return clear(conn, plan_id, date);
    }
    conn.execute(
        "INSERT INTO corrections (plan_id, date, seconds, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (plan_id, date) DO UPDATE SET seconds = excluded.seconds, updated_at = excluded.updated_at",
        params![plan_id, format_date(date), seconds, ctx.now_ms],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::plans::{create, sample_input, set_archived};
    use crate::domain::sessions::{start, stop};
    use crate::domain::testing::{conn, ctx_at, d};

    fn setup() -> (Connection, i64) {
        let mut conn = conn();
        let plan = create(
            &mut conn,
            &ctx_at("2026-11-01", 0),
            &sample_input(600, "2026-11-01", "2026-11-30"),
        )
        .unwrap();
        (conn, plan.id)
    }

    fn studied(conn: &Connection, ctx: &Ctx, plan_id: i64) -> i64 {
        sessions::studied_by_plan_day(conn, ctx, ctx.today, ctx.today)
            .unwrap()
            .get(&(plan_id, ctx.today))
            .copied()
            .unwrap_or(0)
    }

    #[test]
    fn corrections_accumulate_into_one_net_value_per_day() {
        let (conn, plan_id) = setup();
        start(&conn, &ctx_at("2026-11-17", 9), plan_id).unwrap();
        let ctx = ctx_at("2026-11-17", 11);
        stop(&conn, &ctx).unwrap();
        assert_eq!(studied(&conn, &ctx, plan_id), 2 * 3600);

        assert_eq!(add_today(&conn, &ctx, plan_id, 30 * 60).unwrap(), 30 * 60);
        assert_eq!(add_today(&conn, &ctx, plan_id, -15).unwrap(), 30 * 60 - 15);
        assert_eq!(studied(&conn, &ctx, plan_id), 2 * 3600 + 30 * 60 - 15);
        assert_eq!(
            list_on(&conn, ctx.today).unwrap(),
            vec![Correction {
                plan_id,
                date: "2026-11-17".into(),
                seconds: 30 * 60 - 15
            }]
        );

        // 加了又减回去：净值为 0 时删除这一行
        assert_eq!(add_today(&conn, &ctx, plan_id, -(30 * 60 - 15)).unwrap(), 0);
        assert!(list_on(&conn, ctx.today).unwrap().is_empty());
    }

    #[test]
    fn total_stays_between_zero_and_elapsed_time_of_today() {
        let (conn, plan_id) = setup();
        start(&conn, &ctx_at("2026-11-17", 9), plan_id).unwrap();
        let ctx = ctx_at("2026-11-17", 10);
        stop(&conn, &ctx).unwrap();

        // 最多扣到 0
        assert_eq!(add_today(&conn, &ctx, plan_id, -5 * 3600).unwrap(), -3600);
        assert_eq!(studied(&conn, &ctx, plan_id), 0);
        // 最多加到今天已经过去的时长（10 点）
        assert_eq!(
            add_today(&conn, &ctx, plan_id, 20 * 3600).unwrap(),
            9 * 3600
        );
        assert_eq!(studied(&conn, &ctx, plan_id), 10 * 3600);
    }

    #[test]
    fn works_while_paused_and_counts_in_plan_totals() {
        let (conn, plan_id) = setup();
        // 没开计时，在纸上练了一小时，直接补上
        let ctx = ctx_at("2026-11-17", 15);
        add_today(&conn, &ctx, plan_id, 3600).unwrap();
        assert_eq!(studied(&conn, &ctx, plan_id), 3600);
        let summary = plans::list_summaries(&conn, &ctx, false).unwrap();
        assert_eq!(summary[0].studied_seconds, 3600);
        assert_eq!(
            total_by_plan(&conn).unwrap().get(&plan_id).copied(),
            Some(3600)
        );
    }

    #[test]
    fn negative_total_after_deleting_sessions_counts_as_zero() {
        let (conn, plan_id) = setup();
        let started = start(&conn, &ctx_at("2026-11-17", 9), plan_id).unwrap();
        let ctx = ctx_at("2026-11-17", 11);
        stop(&conn, &ctx).unwrap();
        add_today(&conn, &ctx, plan_id, -3600).unwrap();
        // 之后删掉了那段计时：修正还在，但当天学习时长不会显示成负数
        sessions::delete(&conn, started.id).unwrap();
        assert_eq!(studied(&conn, &ctx, plan_id), 0);
        assert_eq!(
            by_plan_day(&conn, d("2026-11-17"), d("2026-11-17"))
                .unwrap()
                .get(&(plan_id, d("2026-11-17")))
                .copied(),
            Some(-3600)
        );
    }

    #[test]
    fn clear_removes_the_correction_and_archived_plans_are_rejected() {
        let (conn, plan_id) = setup();
        let ctx = ctx_at("2026-11-17", 15);
        add_today(&conn, &ctx, plan_id, 600).unwrap();
        clear(&conn, plan_id, ctx.today).unwrap();
        assert_eq!(studied(&conn, &ctx, plan_id), 0);

        set_archived(&conn, &ctx, plan_id, true).unwrap();
        assert!(add_today(&conn, &ctx, plan_id, 600).is_err());
    }
}
