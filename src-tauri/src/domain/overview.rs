//! 概览统计：时钟、月历、某天详情、计时器状态。

use std::collections::HashMap;

use chrono::{Months, NaiveDate};
use rusqlite::Connection;

use super::Ctx;
use super::adjustments::{self, Ledger, load_ledger, shortfall_minutes};
use super::allocation::is_study_weekday;
use super::model::{
    Clock, DayCell, DayDetail, DayPlanEntry, MonthOverview, Plan, PlanDayProgress, TimerStatus,
};
use super::{plans, sessions, todos};
use crate::error::{AppError, AppResult};
use crate::time::{day_range_ms, format_date, next_day, parse_date, prev_day};

pub fn clock(ctx: &Ctx) -> Clock {
    Clock {
        now_ms: ctx.now_ms,
        today: format_date(ctx.today),
        timezone: ctx.tz.name().to_string(),
    }
}

/// 计划在某天的实际目标：已归档计划不再产生今天及以后的目标
fn effective_target(plan: &Plan, ledger: &Ledger, date: NaiveDate, today: NaiveDate) -> i64 {
    if plan.archived && date >= today {
        0
    } else {
        ledger.target()
    }
}

pub fn month(conn: &Connection, ctx: &Ctx, year: i32, month: u32) -> AppResult<MonthOverview> {
    let first = NaiveDate::from_ymd_opt(year, month, 1)
        .ok_or_else(|| AppError::invalid("年份或月份不正确"))?;
    let last = first
        .checked_add_months(Months::new(1))
        .map(prev_day)
        .ok_or_else(|| AppError::invalid("年份或月份不正确"))?;

    let plans = plans::list(conn, true)?;
    let ledger = load_ledger(conn, first, last, None)?;
    let studied = sessions::studied_by_plan_day(conn, ctx, first, last)?;

    let mut days = Vec::new();
    let mut date = first;
    while date <= last {
        let mut cell = DayCell {
            date: format_date(date),
            target_minutes: 0,
            studied_seconds: 0,
            plan_count: 0,
            adjusted: false,
            pending_minutes: 0,
        };
        for plan in &plans {
            let entry = ledger.get(&(plan.id, date)).copied().unwrap_or_default();
            let target = effective_target(plan, &entry, date, ctx.today);
            let seconds = studied.get(&(plan.id, date)).copied().unwrap_or(0);
            if target == 0 && seconds == 0 && !entry.adjusted() {
                continue;
            }
            cell.target_minutes += target;
            cell.studied_seconds += seconds;
            cell.plan_count += 1;
            cell.adjusted |= entry.adjusted();
            if date < ctx.today && !plan.archived {
                cell.pending_minutes += shortfall_minutes(target, seconds);
            }
        }
        days.push(cell);
        date = next_day(date);
    }

    Ok(MonthOverview {
        year,
        month,
        today: format_date(ctx.today),
        days,
    })
}

pub fn day(conn: &Connection, ctx: &Ctx, date: &str) -> AppResult<DayDetail> {
    let date = parse_date(date)?;
    let plans = plans::list(conn, true)?;
    let ledger = load_ledger(conn, date, date, None)?;
    let studied = sessions::studied_by_plan_day(conn, ctx, date, date)?;

    let mut entries = Vec::new();
    for plan in &plans {
        let entry = ledger.get(&(plan.id, date)).copied().unwrap_or_default();
        let seconds = studied.get(&(plan.id, date)).copied().unwrap_or(0);
        let start = parse_date(&plan.start_date)?;
        let end = parse_date(&plan.end_date)?;
        let is_study_day = !plan.archived
            && (start..=end).contains(&date)
            && is_study_weekday(date, plan.study_weekdays);
        let target = effective_target(plan, &entry, date, ctx.today);
        if !is_study_day && target == 0 && seconds == 0 && !entry.adjusted() {
            continue;
        }
        let pending_minutes = if date < ctx.today && !plan.archived {
            shortfall_minutes(target, seconds)
        } else {
            0
        };
        entries.push(DayPlanEntry {
            plan_id: plan.id,
            name: plan.name.clone(),
            color: plan.color.clone(),
            is_study_day,
            target_minutes: target,
            base_minutes: entry.base,
            incoming_minutes: entry.incoming,
            outgoing_minutes: entry.outgoing,
            studied_seconds: seconds,
            pending_minutes,
        });
    }

    let (from_ms, to_ms) = day_range_ms(date, ctx.tz);
    Ok(DayDetail {
        date: format_date(date),
        today: format_date(ctx.today),
        plans: entries,
        sessions: sessions::list_overlapping(conn, from_ms, to_ms, ctx.now_ms)?,
        todos: todos::list(conn, &format_date(date))?,
        adjustments: adjustments::list_touching(conn, date)?,
    })
}

pub fn timer_status(conn: &Connection, ctx: &Ctx) -> AppResult<TimerStatus> {
    let running = sessions::running(conn)?;
    let plan_today = match &running {
        Some(session) => {
            let ledger: HashMap<_, _> =
                load_ledger(conn, ctx.today, ctx.today, Some(session.plan_id))?;
            let target = ledger
                .get(&(session.plan_id, ctx.today))
                .copied()
                .unwrap_or_default()
                .target();
            let studied_seconds = sessions::studied_by_plan_day(conn, ctx, ctx.today, ctx.today)?
                .get(&(session.plan_id, ctx.today))
                .copied()
                .unwrap_or(0);
            Some(PlanDayProgress {
                plan_id: session.plan_id,
                target_minutes: target,
                studied_seconds,
            })
        }
        None => None,
    };
    Ok(TimerStatus {
        now_ms: ctx.now_ms,
        today: format_date(ctx.today),
        running,
        plan_today,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::model::{AdjustMode, AdjustRequest};
    use crate::domain::plans::{create, sample_input};
    use crate::domain::testing::{conn, ctx_at};

    #[test]
    fn month_overview_aggregates_targets_and_pending() {
        let mut conn = conn();
        let plan = create(
            &mut conn,
            &ctx_at("2026-11-01", 0),
            &sample_input(600, "2026-11-01", "2026-11-10"),
        )
        .unwrap();
        let ctx = ctx_at("2026-11-03", 12);
        sessions::start(&conn, &ctx_at("2026-11-01", 9), plan.id).unwrap();
        sessions::stop(&conn, &ctx_at("2026-11-01", 10)).unwrap();

        let overview = month(&conn, &ctx, 2026, 11).unwrap();
        assert_eq!(overview.days.len(), 30);
        let day1 = &overview.days[0];
        assert_eq!(
            (
                day1.target_minutes,
                day1.studied_seconds,
                day1.pending_minutes
            ),
            (60, 3600, 0)
        );
        let day2 = &overview.days[1];
        assert_eq!((day2.target_minutes, day2.pending_minutes), (60, 60));
        // 今天及以后不算挂起
        assert_eq!(overview.days[2].pending_minutes, 0);
        // 期限之外没有计划
        assert_eq!(overview.days[15].plan_count, 0);
    }

    #[test]
    fn day_detail_reflects_adjustments() {
        let mut conn = conn();
        let plan = create(
            &mut conn,
            &ctx_at("2026-11-01", 0),
            &sample_input(600, "2026-11-01", "2026-11-10"),
        )
        .unwrap();
        let ctx = ctx_at("2026-11-03", 12);
        adjustments::adjust(
            &mut conn,
            &ctx,
            &AdjustRequest {
                plan_id: plan.id,
                from_date: "2026-11-02".into(),
                minutes: 60,
                mode: AdjustMode::NextDay,
                items: Vec::new(),
            },
            false,
        )
        .unwrap();
        let detail = day(&conn, &ctx, "2026-11-03").unwrap();
        let entry = &detail.plans[0];
        assert_eq!(
            (
                entry.base_minutes,
                entry.incoming_minutes,
                entry.target_minutes
            ),
            (60, 60, 120)
        );
        assert_eq!(detail.adjustments.len(), 1);

        let from = day(&conn, &ctx, "2026-11-02").unwrap();
        assert_eq!(
            (
                from.plans[0].outgoing_minutes,
                from.plans[0].pending_minutes
            ),
            (60, 0)
        );
    }

    #[test]
    fn archived_plan_has_no_future_targets() {
        let mut conn = conn();
        let ctx = ctx_at("2026-11-05", 12);
        let plan = create(
            &mut conn,
            &ctx_at("2026-11-01", 0),
            &sample_input(600, "2026-11-01", "2026-11-10"),
        )
        .unwrap();
        plans::set_archived(&conn, &ctx, plan.id, true).unwrap();
        let overview = month(&conn, &ctx, 2026, 11).unwrap();
        assert_eq!(overview.days[3].target_minutes, 60);
        assert_eq!(overview.days[5].target_minutes, 0);
        assert_eq!(overview.days[3].pending_minutes, 0);
    }

    #[test]
    fn timer_status_reports_today_progress() {
        let mut conn = conn();
        let plan = create(
            &mut conn,
            &ctx_at("2026-11-01", 0),
            &sample_input(600, "2026-11-01", "2026-11-10"),
        )
        .unwrap();
        sessions::start(&conn, &ctx_at("2026-11-02", 9), plan.id).unwrap();
        let status = timer_status(&conn, &ctx_at("2026-11-02", 10)).unwrap();
        let progress = status.plan_today.unwrap();
        assert_eq!(
            (progress.target_minutes, progress.studied_seconds),
            (60, 3600)
        );
        assert!(status.running.is_some());
    }
}
