//! 应用设置：整体以 JSON 保存，新增字段有默认值，旧数据可以直接读取。

use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::time::{SYSTEM_TIMEZONE, validate_timezone};

const SETTINGS_KEY: &str = "app";

/// 未达标时长的默认处理方式
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum ShortfallDefault {
    /// 挂起，等用户手动处理
    #[default]
    Suspend,
    /// 自动均分到后续学习日
    Spread,
    /// 自动全部加到下一个学习日
    NextDay,
}

/// 倒计时归零后的行为
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum CountdownEnd {
    /// 自动暂停并提醒
    #[default]
    Pause,
    /// 继续计时，醒目显示额外学习的时长
    Continue,
}

/// 计时器外观
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum TimerStyle {
    /// 电子计时器
    #[default]
    Digital,
    /// 物理小秒表
    Analog,
}

/// 计时器默认显示方式
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum TimerDisplay {
    /// 倒计时：今日目标 - 已学
    #[default]
    CountDown,
    /// 正计时：今天已学
    CountUp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// `system` 或 IANA 时区名，决定「哪一天」与日界线
    pub timezone: String,
    pub shortfall_default: ShortfallDefault,
    pub countdown_end: CountdownEnd,
    pub timer_style: TimerStyle,
    pub timer_display: TimerDisplay,
    /// 开始 / 暂停计时的全局快捷键
    pub toggle_hotkey: String,
    /// 关闭窗口时缩到托盘（否则直接退出）
    pub close_to_tray: bool,
    /// 静默启动：开机自启时不显示窗口，只在托盘运行
    pub silent_start: bool,
    /// 单次计时超过多少分钟提醒，0 表示不提醒
    pub long_session_minutes: i64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            timezone: SYSTEM_TIMEZONE.into(),
            shortfall_default: ShortfallDefault::default(),
            countdown_end: CountdownEnd::default(),
            timer_style: TimerStyle::default(),
            timer_display: TimerDisplay::default(),
            toggle_hotkey: "Ctrl+Shift+F12".into(),
            close_to_tray: true,
            silent_start: false,
            long_session_minutes: 180,
        }
    }
}

impl Settings {
    fn validate(&self) -> AppResult<()> {
        validate_timezone(&self.timezone)?;
        if !(0..=24 * 60).contains(&self.long_session_minutes) {
            return Err(AppError::invalid("长时间计时提醒需在 0 ~ 1440 分钟之间"));
        }
        let hotkey = self.toggle_hotkey.trim();
        if hotkey.is_empty() || hotkey.chars().count() > 50 {
            return Err(AppError::invalid("快捷键格式不正确"));
        }
        Ok(())
    }
}

/// 读取设置；尚未保存过或内容损坏时返回默认值
pub fn get(conn: &Connection) -> AppResult<Settings> {
    let stored: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [SETTINGS_KEY],
            |row| row.get(0),
        )
        .optional()?;
    Ok(stored
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default())
}

/// 按字段合并更新：`patch` 中出现的字段覆盖原值
pub fn update(conn: &Connection, patch: &Value) -> AppResult<Settings> {
    let Value::Object(patch) = patch else {
        return Err(AppError::invalid("设置格式不正确"));
    };
    let mut merged =
        serde_json::to_value(get(conn)?).map_err(|err| AppError::Internal(err.to_string()))?;
    let Value::Object(fields) = &mut merged else {
        return Err(AppError::Internal("设置序列化结果不是对象".into()));
    };
    for (key, value) in patch {
        if !fields.contains_key(key) {
            return Err(AppError::invalid(format!("未知的设置项：{key}")));
        }
        fields.insert(key.clone(), value.clone());
    }
    let settings: Settings = serde_json::from_value(merged)
        .map_err(|err| AppError::invalid(format!("设置值不正确：{err}")))?;
    settings.validate()?;

    let json =
        serde_json::to_string(&settings).map_err(|err| AppError::Internal(err.to_string()))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params![SETTINGS_KEY, json],
    )?;
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::testing::conn;
    use serde_json::json;

    #[test]
    fn defaults_when_empty() {
        let conn = conn();
        assert_eq!(get(&conn).unwrap(), Settings::default());
    }

    #[test]
    fn partial_update_merges_fields() {
        let conn = conn();
        let updated = update(
            &conn,
            &json!({ "timezone": "Asia/Shanghai", "timerStyle": "analog" }),
        )
        .unwrap();
        assert_eq!(updated.timezone, "Asia/Shanghai");
        assert_eq!(updated.timer_style, TimerStyle::Analog);
        assert_eq!(updated.countdown_end, CountdownEnd::Pause);
        assert_eq!(get(&conn).unwrap(), updated);
    }

    #[test]
    fn settings_saved_by_older_versions_get_new_defaults() {
        let conn = conn();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params![
                SETTINGS_KEY,
                r#"{"timezone":"Asia/Shanghai","closeToTray":false}"#
            ],
        )
        .unwrap();
        let settings = get(&conn).unwrap();
        assert_eq!(settings.timezone, "Asia/Shanghai");
        assert!(!settings.close_to_tray);
        assert!(!settings.silent_start);

        let updated = update(&conn, &json!({ "silentStart": true })).unwrap();
        assert!(updated.silent_start);
        assert_eq!(updated.timezone, "Asia/Shanghai");
    }

    #[test]
    fn rejects_invalid_values() {
        let conn = conn();
        assert!(update(&conn, &json!({ "timezone": "Mars/Base" })).is_err());
        assert!(update(&conn, &json!({ "timerStyle": "sundial" })).is_err());
        assert!(update(&conn, &json!({ "unknownKey": 1 })).is_err());
        assert!(update(&conn, &json!({ "longSessionMinutes": -5 })).is_err());
        assert!(update(&conn, &json!("not an object")).is_err());
        assert_eq!(get(&conn).unwrap(), Settings::default());
    }
}
