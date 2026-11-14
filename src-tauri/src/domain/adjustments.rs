//! 每日目标的调整与未达标处理。
//!
//! 某计划某天的实际目标 = 基础分配 - 调出 + 调入。
//! 过去的日子里没学够的部分即「挂起待处理」，用户可以：
//! 均分到后续学习日、拆分到指定日子，或全部加到下一个学习日。
//! 当天不方便学习时，也可以提前把今天的时长挪走。

use std::collections::{HashMap, HashSet};

use chrono::NaiveDate;
use rusqlite::{Connection, OptionalExtension, params};

use super::Ctx;
use super::allocation::{distribute, is_study_weekday, next_study_day, study_days};
use super::model::{AdjustItem, AdjustMode, AdjustRequest, Adjustment, PendingShortfall, Plan};
use super::settings::ShortfallDefault;
use super::{plans, sessions};
use crate::error::{AppError, AppResult};
use crate::time::{format_date, next_day, parse_date, prev_day};

/// 某计划某天的分钟账
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct Ledger {
    pub base: i64,
    pub incoming: i64,
    pub outgoing: i64,
}

impl Ledger {
    pub fn target(&self) -> i64 {
        (self.base - self.outgoing + self.incoming).max(0)
    }

    pub fn adjusted(&self) -> bool {
        self.incoming > 0 || self.outgoing > 0
    }
}

/// 未完成的分钟数（不足 1 分钟按 1 分钟计，保证调走后不再残留）
pub fn shortfall_minutes(target_minutes: i64, studied_seconds: i64) -> i64 {
    let missing = target_minutes * 60 - studied_seconds;
    if missing <= 0 { 0 } else { (missing + 59) / 60 }
}

/// 读取 `[from, to]` 内的分钟账；`plan_id` 为空时读取全部计划
pub fn load_ledger(
    conn: &Connection,
    from: NaiveDate,
    to: NaiveDate,
    plan_id: Option<i64>,
) -> AppResult<HashMap<(i64, NaiveDate), Ledger>> {
    let from = format_date(from);
    let to = format_date(to);
    let plan = plan_id.unwrap_or(-1);
    let query = |sql: &str| -> AppResult<Vec<(i64, String, i64)>> {
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt
            .query_map(params![from, to, plan], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    };

    let mut ledger: HashMap<(i64, NaiveDate), Ledger> = HashMap::new();
    for (plan_id, date, minutes) in query(
        "SELECT plan_id, date, base_minutes FROM plan_days
         WHERE date BETWEEN ?1 AND ?2 AND (?3 = -1 OR plan_id = ?3)",
    )? {
        ledger
            .entry((plan_id, parse_date(&date)?))
            .or_default()
            .base += minutes;
    }
    for (plan_id, date, minutes) in query(
        "SELECT a.plan_id, a.from_date, SUM(i.minutes) FROM adjustments a
         JOIN adjustment_items i ON i.adjustment_id = a.id
         WHERE a.from_date BETWEEN ?1 AND ?2 AND (?3 = -1 OR a.plan_id = ?3)
         GROUP BY a.plan_id, a.from_date",
    )? {
        ledger
            .entry((plan_id, parse_date(&date)?))
            .or_default()
            .outgoing += minutes;
    }
    for (plan_id, date, minutes) in query(
        "SELECT a.plan_id, i.to_date, SUM(i.minutes) FROM adjustments a
         JOIN adjustment_items i ON i.adjustment_id = a.id
         WHERE i.to_date BETWEEN ?1 AND ?2 AND (?3 = -1 OR a.plan_id = ?3)
         GROUP BY a.plan_id, i.to_date",
    )? {
        ledger
            .entry((plan_id, parse_date(&date)?))
            .or_default()
            .incoming += minutes;
    }
    Ok(ledger)
}

/// 某计划某天还能调出的分钟数（= 尚未完成的部分）
pub fn movable_minutes(
    conn: &Connection,
    ctx: &Ctx,
    plan_id: i64,
    date: NaiveDate,
) -> AppResult<i64> {
    let ledger = load_ledger(conn, date, date, Some(plan_id))?
        .remove(&(plan_id, date))
        .unwrap_or_default();
    let studied = sessions::studied_by_plan_day(conn, ctx, date, date)?
        .get(&(plan_id, date))
        .copied()
        .unwrap_or(0);
    Ok(shortfall_minutes(ledger.target(), studied))
}

fn format_minutes(minutes: i64) -> String {
    match (minutes / 60, minutes % 60) {
        (0, m) => format!("{m} 分钟"),
        (h, 0) => format!("{h} 小时"),
        (h, m) => format!("{h} 小时 {m} 分钟"),
    }
}

/// 把某天的若干分钟挪到其他日子
pub fn adjust(
    conn: &mut Connection,
    ctx: &Ctx,
    request: &AdjustRequest,
    auto: bool,
) -> AppResult<Adjustment> {
    let plan = plans::get(conn, request.plan_id)?;
    if plan.archived {
        return Err(AppError::invalid("计划已归档，不能调整"));
    }
    let from = parse_date(&request.from_date)?;
    if request.minutes <= 0 {
        return Err(AppError::invalid("调整的时长必须大于 0"));
    }
    let movable = movable_minutes(conn, ctx, plan.id, from)?;
    if movable == 0 {
        return Err(AppError::invalid("这一天没有可以调出的时长"));
    }
    if request.minutes > movable {
        return Err(AppError::invalid(format!(
            "这一天最多还能调出 {}",
            format_minutes(movable)
        )));
    }

    let items = plan_items(&plan, ctx, from, request)?;

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO adjustments (plan_id, from_date, mode, auto, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![plan.id, format_date(from), request.mode.as_str(), auto, ctx.now_ms],
    )?;
    let id = tx.last_insert_rowid();
    {
        let mut stmt = tx.prepare(
            "INSERT INTO adjustment_items (adjustment_id, to_date, minutes) VALUES (?1, ?2, ?3)",
        )?;
        for (date, minutes) in &items {
            stmt.execute(params![id, format_date(*date), minutes])?;
        }
    }
    tx.commit()?;
    get(conn, id)
}

/// 根据处理方式算出每段放到哪天、多少分钟
fn plan_items(
    plan: &Plan,
    ctx: &Ctx,
    from: NaiveDate,
    request: &AdjustRequest,
) -> AppResult<Vec<(NaiveDate, i64)>> {
    // 只能往「今天及以后」、且晚于原日期的日子里放
    let earliest = next_day(from).max(ctx.today);
    match request.mode {
        AdjustMode::Spread => {
            let end = parse_date(&plan.end_date)?;
            let days = if earliest <= end {
                study_days(earliest, end, plan.study_weekdays)
            } else {
                Vec::new()
            };
            if days.is_empty() {
                return Err(AppError::invalid(
                    "期限内已经没有后续学习日，可以改用「拆分」或「全加到下一天」",
                ));
            }
            Ok(distribute(request.minutes, &days)
                .into_iter()
                .filter(|(_, minutes)| *minutes > 0)
                .collect())
        }
        AdjustMode::NextDay => {
            let day = if is_study_weekday(earliest, plan.study_weekdays) {
                earliest
            } else {
                next_study_day(earliest, plan.study_weekdays)
            };
            Ok(vec![(day, request.minutes)])
        }
        AdjustMode::Split => {
            if request.items.is_empty() {
                return Err(AppError::invalid("请至少添加一段"));
            }
            let mut seen = HashSet::new();
            let mut total = 0;
            let mut items = Vec::with_capacity(request.items.len());
            for item in &request.items {
                let date = parse_date(&item.date)?;
                if date < ctx.today {
                    return Err(AppError::invalid("不能调整到已经过去的日子"));
                }
                if date == from {
                    return Err(AppError::invalid("不能调整到同一天"));
                }
                if item.minutes <= 0 {
                    return Err(AppError::invalid("每段时长必须大于 0"));
                }
                if !seen.insert(date) {
                    return Err(AppError::invalid("同一天只能出现一次"));
                }
                total += item.minutes;
                items.push((date, item.minutes));
            }
            if total != request.minutes {
                return Err(AppError::invalid(format!(
                    "各段合计 {}，与要调出的 {} 不一致",
                    format_minutes(total),
                    format_minutes(request.minutes)
                )));
            }
            items.sort();
            Ok(items)
        }
    }
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Adjustment> {
    let row: Option<(i64, String, String, bool, i64)> = conn
        .query_row(
            "SELECT plan_id, from_date, mode, auto, created_at FROM adjustments WHERE id = ?1",
            [id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .optional()?;
    let (plan_id, from_date, mode, auto, created_at) = row.ok_or(AppError::NotFound("该调整"))?;
    let mut stmt = conn.prepare(
        "SELECT to_date, minutes FROM adjustment_items WHERE adjustment_id = ?1 ORDER BY to_date",
    )?;
    let items = stmt
        .query_map([id], |row| {
            Ok(AdjustItem {
                date: row.get(0)?,
                minutes: row.get(1)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(Adjustment {
        id,
        plan_id,
        from_date,
        mode: AdjustMode::parse(&mode),
        auto,
        items,
        created_at,
    })
}

/// 撤销一次调整，相关日子的目标恢复原样
pub fn undo(conn: &Connection, id: i64) -> AppResult<()> {
    let changed = conn.execute("DELETE FROM adjustments WHERE id = ?1", [id])?;
    if changed == 0 {
        return Err(AppError::NotFound("该调整"));
    }
    Ok(())
}

/// 涉及某天（调出或调入）的全部调整
pub fn list_touching(conn: &Connection, date: NaiveDate) -> AppResult<Vec<Adjustment>> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT a.id FROM adjustments a
         LEFT JOIN adjustment_items i ON i.adjustment_id = a.id
         WHERE a.from_date = ?1 OR i.to_date = ?1
         ORDER BY a.id",
    )?;
    let ids = stmt
        .query_map([format_date(date)], |row| row.get::<_, i64>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    ids.into_iter().map(|id| get(conn, id)).collect()
}

/// 过去的日子里尚未处理的未达标时长（不含已归档的计划）
pub fn pending(conn: &Connection, ctx: &Ctx) -> AppResult<Vec<PendingShortfall>> {
    let plans: HashMap<i64, Plan> = plans::list(conn, false)?
        .into_iter()
        .map(|plan| (plan.id, plan))
        .collect();
    let yesterday = prev_day(ctx.today);
    let Some(earliest) = plans
        .values()
        .filter_map(|plan| parse_date(&plan.start_date).ok())
        .min()
    else {
        return Ok(Vec::new());
    };
    if earliest > yesterday {
        return Ok(Vec::new());
    }

    let ledger = load_ledger(conn, earliest, yesterday, None)?;
    let studied = sessions::studied_by_plan_day(conn, ctx, earliest, yesterday)?;
    let mut items: Vec<PendingShortfall> = ledger
        .iter()
        .filter_map(|((plan_id, date), entry)| {
            let plan = plans.get(plan_id)?;
            let seconds = studied.get(&(*plan_id, *date)).copied().unwrap_or(0);
            let minutes = shortfall_minutes(entry.target(), seconds);
            (minutes > 0).then(|| PendingShortfall {
                plan_id: *plan_id,
                plan_name: plan.name.clone(),
                date: format_date(*date),
                minutes,
            })
        })
        .collect();
    items.sort_by(|a, b| a.date.cmp(&b.date).then(a.plan_id.cmp(&b.plan_id)));
    Ok(items)
}

/// 按「未达标默认处理方式」自动处理挂起的时长，返回处理的条数。
/// 无法自动处理的（例如期限已过）保持挂起。
pub fn auto_resolve(
    conn: &mut Connection,
    ctx: &Ctx,
    default: ShortfallDefault,
) -> AppResult<usize> {
    let mode = match default {
        ShortfallDefault::Suspend => return Ok(0),
        ShortfallDefault::Spread => AdjustMode::Spread,
        ShortfallDefault::NextDay => AdjustMode::NextDay,
    };
    let mut resolved = 0;
    for item in pending(conn, ctx)? {
        let request = AdjustRequest {
            plan_id: item.plan_id,
            from_date: item.date,
            minutes: item.minutes,
            mode,
            items: Vec::new(),
        };
        match adjust(conn, ctx, &request, true) {
            Ok(_) => resolved += 1,
            Err(AppError::Invalid(_)) => {}
            Err(err) => return Err(err),
        }
    }
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::model::SessionInput;
    use crate::domain::plans::{create, sample_input};
    use crate::domain::testing::{conn, ctx_at, d, ms_at};

    /// 11-01 ~ 11-10，每天 60 分钟
    fn setup() -> (Connection, i64) {
        let mut conn = conn();
        let plan = create(
            &mut conn,
            &ctx_at("2026-11-01", 0),
            &sample_input(600, "2026-11-01", "2026-11-10"),
        )
        .unwrap();
        (conn, plan.id)
    }

    fn study(conn: &Connection, plan_id: i64, date: &str, from_hour: i64, to_hour: i64) {
        sessions::add_manual(
            conn,
            &ctx_at("2026-12-31", 0),
            &SessionInput {
                plan_id,
                start_at: ms_at(date, from_hour),
                end_at: ms_at(date, to_hour),
                note: String::new(),
            },
        )
        .unwrap();
    }

    fn target(conn: &Connection, plan_id: i64, date: &str) -> i64 {
        load_ledger(conn, d(date), d(date), Some(plan_id))
            .unwrap()
            .get(&(plan_id, d(date)))
            .copied()
            .unwrap_or_default()
            .target()
    }

    fn request(plan_id: i64, from: &str, minutes: i64, mode: AdjustMode) -> AdjustRequest {
        AdjustRequest {
            plan_id,
            from_date: from.into(),
            minutes,
            mode,
            items: Vec::new(),
        }
    }

    #[test]
    fn shortfall_rounds_up_partial_minutes() {
        assert_eq!(shortfall_minutes(60, 3600), 0);
        assert_eq!(shortfall_minutes(60, 4000), 0);
        assert_eq!(shortfall_minutes(60, 3599), 1);
        assert_eq!(shortfall_minutes(60, 0), 60);
    }

    #[test]
    fn past_shortfall_becomes_pending() {
        let (conn, plan_id) = setup();
        // 11-01 学够，11-02 学了 0，11-03 学了 30 分钟（今天是 11-04）
        study(&conn, plan_id, "2026-11-01", 9, 10);
        sessions::add_manual(
            &conn,
            &ctx_at("2026-12-31", 0),
            &SessionInput {
                plan_id,
                start_at: ms_at("2026-11-03", 9),
                end_at: ms_at("2026-11-03", 9) + 30 * 60_000,
                note: String::new(),
            },
        )
        .unwrap();
        let items = pending(&conn, &ctx_at("2026-11-04", 12)).unwrap();
        let summary: Vec<(&str, i64)> = items
            .iter()
            .map(|item| (item.date.as_str(), item.minutes))
            .collect();
        assert_eq!(summary, vec![("2026-11-02", 60), ("2026-11-03", 30)]);
    }

    #[test]
    fn spread_moves_shortfall_to_remaining_days() {
        let (mut conn, plan_id) = setup();
        let ctx = ctx_at("2026-11-05", 12);
        // 11-02 的 60 分钟均分到 11-05 ~ 11-10（6 天，各 10 分钟）
        let adjustment = adjust(
            &mut conn,
            &ctx,
            &request(plan_id, "2026-11-02", 60, AdjustMode::Spread),
            false,
        )
        .unwrap();
        assert_eq!(adjustment.items.len(), 6);
        assert_eq!(target(&conn, plan_id, "2026-11-02"), 0);
        assert_eq!(target(&conn, plan_id, "2026-11-05"), 70);
        assert_eq!(target(&conn, plan_id, "2026-11-10"), 70);
        assert!(
            pending(&conn, &ctx)
                .unwrap()
                .iter()
                .all(|p| p.date != "2026-11-02")
        );
    }

    #[test]
    fn next_day_skips_non_study_days() {
        let mut conn = conn();
        let mut input = sample_input(600, "2026-11-09", "2026-11-20");
        input.study_weekdays = 0b001_1111; // 周一到周五
        let plan = create(&mut conn, &ctx_at("2026-11-09", 0), &input).unwrap();
        // 周五（11-13）当天把今天的任务整体挪走 → 下一个学习日是周一 11-16
        let ctx = ctx_at("2026-11-13", 8);
        let movable = movable_minutes(&conn, &ctx, plan.id, d("2026-11-13")).unwrap();
        let adjustment = adjust(
            &mut conn,
            &ctx,
            &request(plan.id, "2026-11-13", movable, AdjustMode::NextDay),
            false,
        )
        .unwrap();
        assert_eq!(adjustment.items[0].date, "2026-11-16");
        assert_eq!(target(&conn, plan.id, "2026-11-13"), 0);
    }

    #[test]
    fn split_validates_items() {
        let (mut conn, plan_id) = setup();
        let ctx = ctx_at("2026-11-05", 12);
        let mut split = request(plan_id, "2026-11-02", 60, AdjustMode::Split);
        split.items = vec![
            AdjustItem {
                date: "2026-11-06".into(),
                minutes: 15,
            },
            AdjustItem {
                date: "2026-11-08".into(),
                minutes: 45,
            },
        ];
        adjust(&mut conn, &ctx, &split, false).unwrap();
        assert_eq!(target(&conn, plan_id, "2026-11-06"), 75);
        assert_eq!(target(&conn, plan_id, "2026-11-08"), 105);

        // 合计不一致
        let mut bad = request(plan_id, "2026-11-03", 60, AdjustMode::Split);
        bad.items = vec![AdjustItem {
            date: "2026-11-06".into(),
            minutes: 30,
        }];
        assert!(adjust(&mut conn, &ctx, &bad, false).is_err());
        // 调到过去
        bad.items = vec![AdjustItem {
            date: "2026-11-04".into(),
            minutes: 60,
        }];
        assert!(adjust(&mut conn, &ctx, &bad, false).is_err());
        // 超出可调出的时长
        let too_much = request(plan_id, "2026-11-03", 61, AdjustMode::NextDay);
        assert!(adjust(&mut conn, &ctx, &too_much, false).is_err());
    }

    #[test]
    fn undo_restores_targets() {
        let (mut conn, plan_id) = setup();
        let ctx = ctx_at("2026-11-05", 12);
        let adjustment = adjust(
            &mut conn,
            &ctx,
            &request(plan_id, "2026-11-02", 60, AdjustMode::NextDay),
            false,
        )
        .unwrap();
        assert_eq!(target(&conn, plan_id, "2026-11-05"), 120);
        undo(&conn, adjustment.id).unwrap();
        assert_eq!(target(&conn, plan_id, "2026-11-05"), 60);
        assert_eq!(target(&conn, plan_id, "2026-11-02"), 60);
    }

    #[test]
    fn auto_resolve_follows_default() {
        let (mut conn, plan_id) = setup();
        study(&conn, plan_id, "2026-11-01", 9, 10);
        let ctx = ctx_at("2026-11-04", 12);
        assert_eq!(
            auto_resolve(&mut conn, &ctx, ShortfallDefault::Suspend).unwrap(),
            0
        );
        assert_eq!(pending(&conn, &ctx).unwrap().len(), 2);

        assert_eq!(
            auto_resolve(&mut conn, &ctx, ShortfallDefault::NextDay).unwrap(),
            2
        );
        assert!(pending(&conn, &ctx).unwrap().is_empty());
        // 11-02、11-03 各欠 60 分钟，都加到今天 11-04
        assert_eq!(target(&conn, plan_id, "2026-11-04"), 180);
        let all = list_touching(&conn, d("2026-11-04")).unwrap();
        assert!(all.iter().all(|a| a.auto));
    }

    #[test]
    fn spread_after_deadline_is_rejected_but_next_day_works() {
        let (mut conn, plan_id) = setup();
        let ctx = ctx_at("2026-11-12", 12);
        assert!(
            adjust(
                &mut conn,
                &ctx,
                &request(plan_id, "2026-11-10", 60, AdjustMode::Spread),
                false
            )
            .is_err()
        );
        let adjustment = adjust(
            &mut conn,
            &ctx,
            &request(plan_id, "2026-11-10", 60, AdjustMode::NextDay),
            false,
        )
        .unwrap();
        assert_eq!(adjustment.items[0].date, "2026-11-12");
    }
}
