//! 学习记录：计时器开始 / 暂停、手动补录与学习时长统计。
//!
//! 计时只记录开始和结束时间戳；正在进行的计时 `end_at` 为空，
//! 程序关闭或崩溃后重新打开，计时状态依然保留。

use std::collections::HashMap;

use chrono::NaiveDate;
use rusqlite::{Connection, OptionalExtension, Row, params};

use super::Ctx;
use super::model::{Session, SessionInput, SessionSource};
use super::{corrections, plans};
use crate::error::{AppError, AppResult};
use crate::time::{day_start_ms, next_day, split_by_day};

/// 短于 1 秒的计时视为误触，暂停时直接丢弃
const MIN_SESSION_MS: i64 = 1000;
const MAX_NOTE_CHARS: usize = 200;

const SELECT_SESSION: &str = "SELECT id, plan_id, start_at, end_at, source, note FROM sessions";

fn map_session(row: &Row) -> rusqlite::Result<Session> {
    Ok(Session {
        id: row.get(0)?,
        plan_id: row.get(1)?,
        start_at: row.get(2)?,
        end_at: row.get(3)?,
        source: SessionSource::parse(&row.get::<_, String>(4)?),
        note: row.get(5)?,
    })
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Session> {
    conn.query_row(
        &format!("{SELECT_SESSION} WHERE id = ?1"),
        [id],
        map_session,
    )
    .optional()?
    .ok_or(AppError::NotFound("该学习记录"))
}

/// 正在进行的计时
pub fn running(conn: &Connection) -> AppResult<Option<Session>> {
    Ok(conn
        .query_row(
            &format!("{SELECT_SESSION} WHERE end_at IS NULL"),
            [],
            map_session,
        )
        .optional()?)
}

pub fn start(conn: &Connection, ctx: &Ctx, plan_id: i64) -> AppResult<Session> {
    let plan = plans::get(conn, plan_id)?;
    if plan.archived {
        return Err(AppError::invalid("计划已归档，不能计时"));
    }
    if running(conn)?.is_some() {
        return Err(AppError::conflict("已经有一个计时正在进行"));
    }
    conn.execute(
        "INSERT INTO sessions (plan_id, start_at, source, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?2, ?2)",
        params![plan_id, ctx.now_ms, SessionSource::Timer.as_str()],
    )?;
    get(conn, conn.last_insert_rowid())
}

/// 暂停正在进行的计时；没有计时或计时不足 1 秒时返回 `None`
pub fn stop(conn: &Connection, ctx: &Ctx) -> AppResult<Option<Session>> {
    let Some(session) = running(conn)? else {
        return Ok(None);
    };
    if ctx.now_ms - session.start_at < MIN_SESSION_MS {
        conn.execute("DELETE FROM sessions WHERE id = ?1", [session.id])?;
        return Ok(None);
    }
    conn.execute(
        "UPDATE sessions SET end_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![ctx.now_ms, session.id],
    )?;
    get(conn, session.id).map(Some)
}

/// 只在指定的那次计时仍在进行时暂停它，返回是否暂停了。
/// 用于响应较早发出的提醒：期间用户可能已经暂停或换了计划，这时什么也不做。
pub fn stop_if_running(conn: &Connection, ctx: &Ctx, session_id: i64) -> AppResult<bool> {
    match running(conn)? {
        Some(session) if session.id == session_id => {
            stop(conn, ctx)?;
            Ok(true)
        }
        _ => Ok(false),
    }
}

fn validate_input(
    conn: &Connection,
    ctx: &Ctx,
    input: &SessionInput,
    exclude_id: Option<i64>,
) -> AppResult<()> {
    plans::get(conn, input.plan_id)?;
    if input.end_at <= input.start_at {
        return Err(AppError::invalid("结束时间必须晚于开始时间"));
    }
    if input.end_at > ctx.now_ms {
        return Err(AppError::invalid("不能记录未来的时间"));
    }
    if input.note.chars().count() > MAX_NOTE_CHARS {
        return Err(AppError::invalid(format!(
            "备注不能超过 {MAX_NOTE_CHARS} 个字"
        )));
    }
    // 同一时间只能在学一件事：不能与其他记录（含正在进行的计时）重叠
    let overlapping: Option<i64> = conn
        .query_row(
            "SELECT id FROM sessions
             WHERE id != ?1 AND start_at < ?2 AND COALESCE(end_at, ?3) > ?4
             LIMIT 1",
            params![
                exclude_id.unwrap_or(-1),
                input.end_at,
                ctx.now_ms,
                input.start_at
            ],
            |row| row.get(0),
        )
        .optional()?;
    if overlapping.is_some() {
        return Err(AppError::conflict("与已有的学习记录时间重叠"));
    }
    Ok(())
}

/// 手动补录
pub fn add_manual(conn: &Connection, ctx: &Ctx, input: &SessionInput) -> AppResult<Session> {
    validate_input(conn, ctx, input, None)?;
    conn.execute(
        "INSERT INTO sessions (plan_id, start_at, end_at, source, note, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![
            input.plan_id,
            input.start_at,
            input.end_at,
            SessionSource::Manual.as_str(),
            input.note.trim(),
            ctx.now_ms
        ],
    )?;
    get(conn, conn.last_insert_rowid())
}

/// 修改已结束的记录（计时器或补录产生的都可以）
pub fn update(conn: &Connection, ctx: &Ctx, id: i64, input: &SessionInput) -> AppResult<Session> {
    let session = get(conn, id)?;
    if session.end_at.is_none() {
        return Err(AppError::conflict("正在计时的记录不能修改，请先暂停"));
    }
    validate_input(conn, ctx, input, Some(id))?;
    conn.execute(
        "UPDATE sessions SET plan_id = ?1, start_at = ?2, end_at = ?3, note = ?4, updated_at = ?5
         WHERE id = ?6",
        params![
            input.plan_id,
            input.start_at,
            input.end_at,
            input.note.trim(),
            ctx.now_ms,
            id
        ],
    )?;
    get(conn, id)
}

/// 删除记录；删除正在进行的计时等于取消本次计时
pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let changed = conn.execute("DELETE FROM sessions WHERE id = ?1", [id])?;
    if changed == 0 {
        return Err(AppError::NotFound("该学习记录"));
    }
    Ok(())
}

/// 与时间段 `[from, to)` 有交集的记录，按开始时间排序
pub fn list_overlapping(
    conn: &Connection,
    from_ms: i64,
    to_ms: i64,
    now_ms: i64,
) -> AppResult<Vec<Session>> {
    let mut stmt = conn.prepare(&format!(
        "{SELECT_SESSION} WHERE start_at < ?2 AND COALESCE(end_at, ?3) > ?1 ORDER BY start_at"
    ))?;
    let sessions = stmt
        .query_map(params![from_ms, to_ms, now_ms], map_session)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(sessions)
}

/// 统计 `[from, to]` 日期范围内，各计划每天的学习秒数：学习记录加上手动修正。
/// 跨日界线的记录按日界线切开分别计入；正在进行的计时算到当前时刻。
/// 修正后小于 0 的（例如扣过时间后又删了学习记录）按 0 计。
pub fn studied_by_plan_day(
    conn: &Connection,
    ctx: &Ctx,
    from: NaiveDate,
    to: NaiveDate,
) -> AppResult<HashMap<(i64, NaiveDate), i64>> {
    let range_start = day_start_ms(from, ctx.tz);
    let range_end = day_start_ms(next_day(to), ctx.tz);
    let mut totals: HashMap<(i64, NaiveDate), i64> = HashMap::new();
    for session in list_overlapping(conn, range_start, range_end, ctx.now_ms)? {
        let start = session.start_at.max(range_start);
        let end = session.end_at.unwrap_or(ctx.now_ms).min(range_end);
        if end <= start {
            continue;
        }
        for (date, ms) in split_by_day(start, end, ctx.tz) {
            *totals.entry((session.plan_id, date)).or_default() += ms;
        }
    }
    let mut seconds: HashMap<(i64, NaiveDate), i64> = totals
        .into_iter()
        .map(|(key, ms)| (key, ms / 1000))
        .collect();
    for (key, correction) in corrections::by_plan_day(conn, from, to)? {
        *seconds.entry(key).or_default() += correction;
    }
    for value in seconds.values_mut() {
        *value = (*value).max(0);
    }
    Ok(seconds)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::plans::{create, sample_input};
    use crate::domain::testing::{HOUR_MS, conn, ctx_at, d, ms_at};

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

    #[test]
    fn start_and_stop_timer() {
        let (conn, plan_id) = setup();
        let started = start(&conn, &ctx_at("2026-11-02", 9), plan_id).unwrap();
        assert!(started.end_at.is_none());
        assert!(start(&conn, &ctx_at("2026-11-02", 9), plan_id).is_err());

        let stopped = stop(&conn, &ctx_at("2026-11-02", 10)).unwrap().unwrap();
        assert_eq!(stopped.end_at, Some(ms_at("2026-11-02", 10)));
        assert!(running(&conn).unwrap().is_none());
        assert!(stop(&conn, &ctx_at("2026-11-02", 11)).unwrap().is_none());
    }

    #[test]
    fn stop_if_running_only_stops_that_session() {
        let (conn, plan_id) = setup();
        let first = start(&conn, &ctx_at("2026-11-02", 9), plan_id).unwrap();
        stop(&conn, &ctx_at("2026-11-02", 10)).unwrap();
        let second = start(&conn, &ctx_at("2026-11-02", 11), plan_id).unwrap();

        // 旧计时的提醒不能暂停新的计时
        assert!(!stop_if_running(&conn, &ctx_at("2026-11-02", 12), first.id).unwrap());
        assert_eq!(running(&conn).unwrap().unwrap().id, second.id);

        assert!(stop_if_running(&conn, &ctx_at("2026-11-02", 12), second.id).unwrap());
        assert!(running(&conn).unwrap().is_none());
        assert!(!stop_if_running(&conn, &ctx_at("2026-11-02", 13), second.id).unwrap());
    }

    #[test]
    fn accidental_tap_is_discarded() {
        let (conn, plan_id) = setup();
        let ctx = ctx_at("2026-11-02", 9);
        start(&conn, &ctx, plan_id).unwrap();
        assert!(stop(&conn, &ctx).unwrap().is_none());
        assert!(
            list_overlapping(&conn, 0, i64::MAX, ctx.now_ms)
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn manual_entry_validation() {
        let (conn, plan_id) = setup();
        let ctx = ctx_at("2026-11-03", 12);
        let input = |start: i64, end: i64| SessionInput {
            plan_id,
            start_at: start,
            end_at: end,
            note: String::new(),
        };
        add_manual(
            &conn,
            &ctx,
            &input(ms_at("2026-11-02", 9), ms_at("2026-11-02", 11)),
        )
        .unwrap();
        // 重叠
        assert!(matches!(
            add_manual(
                &conn,
                &ctx,
                &input(ms_at("2026-11-02", 10), ms_at("2026-11-02", 12))
            ),
            Err(AppError::Conflict(_))
        ));
        // 结束早于开始
        assert!(
            add_manual(
                &conn,
                &ctx,
                &input(ms_at("2026-11-02", 15), ms_at("2026-11-02", 14))
            )
            .is_err()
        );
        // 未来时间
        assert!(
            add_manual(
                &conn,
                &ctx,
                &input(ms_at("2026-11-03", 11), ms_at("2026-11-03", 13))
            )
            .is_err()
        );
        // 紧挨着不算重叠
        add_manual(
            &conn,
            &ctx,
            &input(ms_at("2026-11-02", 11), ms_at("2026-11-02", 12)),
        )
        .unwrap();
    }

    #[test]
    fn running_timer_cannot_be_edited() {
        let (conn, plan_id) = setup();
        let session = start(&conn, &ctx_at("2026-11-02", 9), plan_id).unwrap();
        let input = SessionInput {
            plan_id,
            start_at: ms_at("2026-11-02", 8),
            end_at: ms_at("2026-11-02", 9),
            note: String::new(),
        };
        assert!(update(&conn, &ctx_at("2026-11-02", 10), session.id, &input).is_err());
    }

    #[test]
    fn studied_time_splits_at_midnight_and_counts_running_timer() {
        let (conn, plan_id) = setup();
        // 11-02 23:00 ~ 11-03 01:00
        start(&conn, &ctx_at("2026-11-02", 23), plan_id).unwrap();
        stop(&conn, &ctx_at("2026-11-03", 1)).unwrap();
        // 11-03 09:00 开始，到 10:30 仍在计时
        start(&conn, &ctx_at("2026-11-03", 9), plan_id).unwrap();
        let now = ctx_at("2026-11-03", 10);
        let now = Ctx::new(now.now_ms + HOUR_MS / 2, now.tz);

        let studied = studied_by_plan_day(&conn, &now, d("2026-11-02"), d("2026-11-03")).unwrap();
        assert_eq!(studied[&(plan_id, d("2026-11-02"))], 3600);
        assert_eq!(studied[&(plan_id, d("2026-11-03"))], 3600 + 5400);
    }
}
