//! 业务核心：计划分配、计时、调整、待办、设置与概览统计。
//!
//! 所有函数显式接收 [`Ctx`]（当前时间与时区），便于测试和保证同一次请求内时间一致。

pub mod adjustments;
pub mod allocation;
pub mod model;
pub mod overview;
pub mod plans;
pub mod sessions;
pub mod settings;
pub mod todos;

use chrono::{NaiveDate, Utc};
use chrono_tz::Tz;
use rusqlite::Connection;

use crate::error::AppResult;
use crate::time::{date_of, resolve_timezone};

/// 一次请求的时间上下文
#[derive(Debug, Clone, Copy)]
pub struct Ctx {
    pub now_ms: i64,
    pub tz: Tz,
    /// 按设置时区计算的「今天」
    pub today: NaiveDate,
}

impl Ctx {
    pub fn new(now_ms: i64, tz: Tz) -> Self {
        Self {
            now_ms,
            tz,
            today: date_of(now_ms, tz),
        }
    }

    /// 以当前时间和设置中的时区创建
    pub fn load(conn: &Connection) -> AppResult<Self> {
        let settings = settings::get(conn)?;
        Ok(Self::new(
            Utc::now().timestamp_millis(),
            resolve_timezone(&settings.timezone),
        ))
    }
}

#[cfg(test)]
pub(crate) mod testing {
    use super::*;
    use crate::time::{day_start_ms, parse_date};

    pub const HOUR_MS: i64 = 3_600_000;

    /// 已迁移的内存数据库
    pub fn conn() -> Connection {
        crate::db::open_test_connection()
    }

    /// UTC 时区下某天某小时的上下文
    pub fn ctx_at(date: &str, hour: i64) -> Ctx {
        Ctx::new(ms_at(date, hour), Tz::UTC)
    }

    /// UTC 时区下某天某小时的时间戳
    pub fn ms_at(date: &str, hour: i64) -> i64 {
        day_start_ms(parse_date(date).unwrap(), Tz::UTC) + hour * HOUR_MS
    }

    pub fn d(value: &str) -> NaiveDate {
        parse_date(value).unwrap()
    }
}
