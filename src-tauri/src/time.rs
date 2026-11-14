//! 日期、时区与日界线。
//!
//! 约定：
//! - 时间点统一用 UTC 毫秒（`i64`）表示；
//! - 「哪一天」按设置中的时区计算，日界线为该时区的 0 点；
//! - 日期在数据库与前端之间用 `YYYY-MM-DD` 字符串传递。

use chrono::{DateTime, Days, NaiveDate, NaiveTime, TimeZone};
use chrono_tz::Tz;

use crate::error::{AppError, AppResult};

const DATE_FORMAT: &str = "%Y-%m-%d";

/// 时区设置值：跟随系统
pub const SYSTEM_TIMEZONE: &str = "system";

pub fn parse_date(value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value, DATE_FORMAT)
        .map_err(|_| AppError::invalid(format!("日期格式不正确：{value}")))
}

pub fn format_date(date: NaiveDate) -> String {
    date.format(DATE_FORMAT).to_string()
}

pub fn next_day(date: NaiveDate) -> NaiveDate {
    date.checked_add_days(Days::new(1)).expect("日期超出范围")
}

pub fn prev_day(date: NaiveDate) -> NaiveDate {
    date.checked_sub_days(Days::new(1)).expect("日期超出范围")
}

/// 系统当前时区；无法识别时退回 UTC
pub fn system_timezone() -> Tz {
    iana_time_zone::get_timezone()
        .ok()
        .and_then(|name| name.parse::<Tz>().ok())
        .unwrap_or(Tz::UTC)
}

/// 把设置中的时区值解析成具体时区
pub fn resolve_timezone(setting: &str) -> Tz {
    if setting == SYSTEM_TIMEZONE {
        system_timezone()
    } else {
        setting.parse::<Tz>().unwrap_or_else(|_| system_timezone())
    }
}

/// 校验时区设置值：`system` 或合法的 IANA 时区名
pub fn validate_timezone(setting: &str) -> AppResult<()> {
    if setting == SYSTEM_TIMEZONE || setting.parse::<Tz>().is_ok() {
        Ok(())
    } else {
        Err(AppError::invalid(format!("无法识别的时区：{setting}")))
    }
}

/// 某天在指定时区的起始时刻（UTC 毫秒）。
/// 若 0 点因夏令时不存在，取当天第一个存在的时刻。
pub fn day_start_ms(date: NaiveDate, tz: Tz) -> i64 {
    let midnight = date.and_time(NaiveTime::MIN);
    if let Some(dt) = tz.from_local_datetime(&midnight).earliest() {
        return dt.timestamp_millis();
    }
    // 0 点落在夏令时跳过的区间内：按 15 分钟向后找
    (1..=24 * 4)
        .find_map(|step| {
            let local = midnight + chrono::Duration::minutes(15 * step);
            tz.from_local_datetime(&local).earliest()
        })
        .map(|dt| dt.timestamp_millis())
        .expect("一天内必然存在有效的本地时间")
}

/// 某天的时间范围 `[开始, 结束)`（UTC 毫秒）
pub fn day_range_ms(date: NaiveDate, tz: Tz) -> (i64, i64) {
    (day_start_ms(date, tz), day_start_ms(next_day(date), tz))
}

/// 某时刻在指定时区属于哪一天
pub fn date_of(ms: i64, tz: Tz) -> NaiveDate {
    DateTime::from_timestamp_millis(ms)
        .expect("时间戳超出范围")
        .with_timezone(&tz)
        .date_naive()
}

/// 把一段时间 `[start, end)` 按日界线切开，返回每天占用的毫秒数
pub fn split_by_day(start_ms: i64, end_ms: i64, tz: Tz) -> Vec<(NaiveDate, i64)> {
    let mut parts = Vec::new();
    let mut cursor = start_ms;
    while cursor < end_ms {
        let date = date_of(cursor, tz);
        let boundary = day_start_ms(next_day(date), tz);
        let segment_end = boundary.min(end_ms);
        parts.push((date, segment_end - cursor));
        cursor = segment_end;
    }
    parts
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(value: &str) -> NaiveDate {
        parse_date(value).unwrap()
    }

    #[test]
    fn day_range_respects_timezone() {
        let shanghai: Tz = "Asia/Shanghai".parse().unwrap();
        let (start, end) = day_range_ms(d("2026-11-14"), shanghai);
        // 上海 0 点 = UTC 前一天 16:00
        assert_eq!(start, 1_794_585_600_000);
        assert_eq!(end - start, 24 * 3600 * 1000);
    }

    #[test]
    fn date_of_uses_timezone() {
        let shanghai: Tz = "Asia/Shanghai".parse().unwrap();
        // UTC 2026-11-13 17:00 = 上海 2026-11-14 01:00
        let ms = 1_794_589_200_000;
        assert_eq!(date_of(ms, shanghai), d("2026-11-14"));
        assert_eq!(date_of(ms, Tz::UTC), d("2026-11-13"));
    }

    #[test]
    fn split_across_midnight() {
        let shanghai: Tz = "Asia/Shanghai".parse().unwrap();
        let midnight = day_start_ms(d("2026-11-14"), shanghai);
        let hour = 3_600_000;
        let parts = split_by_day(midnight - hour, midnight + 2 * hour, shanghai);
        assert_eq!(
            parts,
            vec![(d("2026-11-13"), hour), (d("2026-11-14"), 2 * hour)]
        );
    }

    #[test]
    fn split_within_one_day() {
        let parts = split_by_day(1000, 5000, Tz::UTC);
        assert_eq!(parts, vec![(d("1970-01-01"), 4000)]);
    }

    #[test]
    fn dst_days_have_correct_length() {
        let new_york: Tz = "America/New_York".parse().unwrap();
        // 2026-03-08 夏令时开始，当天只有 23 小时
        let (start, end) = day_range_ms(d("2026-03-08"), new_york);
        assert_eq!(end - start, 23 * 3600 * 1000);
        // 2026-11-01 夏令时结束，当天有 25 小时
        let (start, end) = day_range_ms(d("2026-11-01"), new_york);
        assert_eq!(end - start, 25 * 3600 * 1000);
    }

    #[test]
    fn midnight_gap_falls_back_to_first_valid_time() {
        // 智利圣地亚哥 2026-09-06 0 点开始夏令时，0:00~1:00 不存在
        let santiago: Tz = "America/Santiago".parse().unwrap();
        let start = day_start_ms(d("2026-09-06"), santiago);
        assert_eq!(date_of(start, santiago), d("2026-09-06"));
        assert_eq!(date_of(start - 1, santiago), d("2026-09-05"));
    }

    #[test]
    fn timezone_validation() {
        assert!(validate_timezone("system").is_ok());
        assert!(validate_timezone("Asia/Shanghai").is_ok());
        assert!(validate_timezone("Mars/Base").is_err());
    }
}
