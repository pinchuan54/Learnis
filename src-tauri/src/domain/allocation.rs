//! 时长分配算法（纯函数，不访问数据库）。

use chrono::{Datelike, NaiveDate};

use crate::time::next_day;

/// 一周七天全部学习
pub const ALL_WEEKDAYS: u8 = 0b111_1111;

/// 某天是否为勾选的学习日（bit0 = 周一 … bit6 = 周日）
pub fn is_study_weekday(date: NaiveDate, weekdays: u8) -> bool {
    weekdays & (1 << date.weekday().num_days_from_monday()) != 0
}

/// `[start, end]` 范围内的所有学习日
pub fn study_days(start: NaiveDate, end: NaiveDate, weekdays: u8) -> Vec<NaiveDate> {
    let mut days = Vec::new();
    let mut date = start;
    while date <= end {
        if is_study_weekday(date, weekdays) {
            days.push(date);
        }
        date = next_day(date);
    }
    days
}

/// 把总分钟数均分到各天；除不尽的余数从最早的日子开始每天多分 1 分钟
pub fn distribute(total_minutes: i64, days: &[NaiveDate]) -> Vec<(NaiveDate, i64)> {
    if days.is_empty() || total_minutes <= 0 {
        return Vec::new();
    }
    let count = days.len() as i64;
    let base = total_minutes / count;
    let remainder = total_minutes % count;
    days.iter()
        .enumerate()
        .map(|(index, date)| (*date, base + i64::from((index as i64) < remainder)))
        .collect()
}

/// `date` 之后（不含）的第一个学习日
pub fn next_study_day(date: NaiveDate, weekdays: u8) -> NaiveDate {
    let mut candidate = next_day(date);
    // 学习日掩码至少勾选一天，7 天内必然能找到
    for _ in 0..7 {
        if is_study_weekday(candidate, weekdays) {
            return candidate;
        }
        candidate = next_day(candidate);
    }
    candidate
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::time::parse_date;

    fn d(value: &str) -> NaiveDate {
        parse_date(value).unwrap()
    }

    #[test]
    fn study_days_skip_unchecked_weekdays() {
        // 2026-11-09 是周一；只学周一到周五
        let weekdays = 0b001_1111;
        let days = study_days(d("2026-11-09"), d("2026-11-22"), weekdays);
        assert_eq!(days.len(), 10);
        assert!(!days.contains(&d("2026-11-14")));
        assert!(!days.contains(&d("2026-11-15")));
    }

    #[test]
    fn distribute_evenly_with_remainder_first() {
        let days = study_days(d("2026-11-09"), d("2026-11-11"), ALL_WEEKDAYS);
        let parts = distribute(10, &days);
        assert_eq!(
            parts,
            vec![
                (d("2026-11-09"), 4),
                (d("2026-11-10"), 3),
                (d("2026-11-11"), 3)
            ]
        );
        assert_eq!(parts.iter().map(|(_, m)| m).sum::<i64>(), 10);
    }

    #[test]
    fn distribute_large_plan_is_lossless() {
        // 1000 小时分到 2027 全年
        let days = study_days(d("2027-01-01"), d("2027-12-31"), ALL_WEEKDAYS);
        let parts = distribute(1000 * 60, &days);
        assert_eq!(parts.len(), 365);
        assert_eq!(parts.iter().map(|(_, m)| m).sum::<i64>(), 60_000);
        let max = parts.iter().map(|(_, m)| *m).max().unwrap();
        let min = parts.iter().map(|(_, m)| *m).min().unwrap();
        assert!(max - min <= 1);
    }

    #[test]
    fn distribute_handles_empty_input() {
        assert!(distribute(100, &[]).is_empty());
        assert!(distribute(0, &[d("2026-11-09")]).is_empty());
    }

    #[test]
    fn next_study_day_skips_weekend() {
        let weekdays = 0b001_1111;
        // 周五之后的下一个学习日是周一
        assert_eq!(next_study_day(d("2026-11-13"), weekdays), d("2026-11-16"));
        assert_eq!(
            next_study_day(d("2026-11-13"), ALL_WEEKDAYS),
            d("2026-11-14")
        );
    }
}
