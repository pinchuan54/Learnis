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

/// 悬浮窗形态
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum FloatForm {
    /// 圆点 + 时间，底色是今天的进度
    #[default]
    Minimal,
    /// 时、分、秒三张翻页小牌
    Flip,
    /// 小圆表：外圈进度环，中间时:分和小秒
    Dial,
}

/// 悬浮窗的「时间流逝感」：一直在动、表示时间在走的短尺度元素
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum FloatFlow {
    /// 刻度带（小圆表上是刻度盘）
    #[default]
    Ruler,
    /// 分钟线：一分钟画满一次
    MinuteLine,
    /// 秒脉搏：每秒轻轻跳一下
    Pulse,
    None,
}

/// 悬浮窗配色：单独设置，和 Learnis 主程序的外观无关
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum FloatSkin {
    /// 白
    Light,
    /// 黑（v0.2.6 的「灵动岛黑」读成这个）
    #[serde(alias = "island")]
    Dark,
    /// 跟随系统的浅色 / 深色（v0.2.6 的「跟随外观」读成这个）
    #[default]
    #[serde(alias = "follow")]
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// `system` 或 IANA 时区名，决定「哪一天」与日界线
    pub timezone: String,
    pub shortfall_default: ShortfallDefault,
    /// 倒计时归零（今天的目标学完）时提醒，由用户选择继续或暂停；计时从不自动停下。
    /// 取代旧版的 `countdownEnd`（自动暂停 / 继续计时），旧数据里的该字段读取时忽略。
    pub countdown_reminder: bool,
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
    /// 月历下方显示图例（各颜色的含义）
    pub show_calendar_legend: bool,
    /// 顶部导航左上角显示应用名称（关闭后只显示标志）
    pub show_app_name: bool,
    /// 计时中把主窗口关到托盘或最小化时，自动出现悬浮窗
    pub float_auto: bool,
    /// 显示 / 隐藏悬浮窗的全局快捷键
    pub float_hotkey: String,
    pub float_form: FloatForm,
    pub float_flow: FloatFlow,
    /// 极简、小圆表显示今天的进度（底色 / 进度环）
    pub float_progress: bool,
    /// 翻页底部的进度细线（单独设置，默认不显示）
    pub float_flip_progress: bool,
    pub float_skin: FloatSkin,
    /// 悬浮窗大小，百分比
    pub float_scale: i64,
    /// 开始 / 暂停按钮一直显示（极简、翻页）
    pub float_pin_button: bool,
    /// 悬停时显示拖角（在贴边方向的对角），拖它缩放
    pub float_grip: bool,
    /// 鼠标离开一会儿后变成半透明
    pub float_dim: bool,
    /// 锁定位置，拖不动
    pub float_locked: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            timezone: SYSTEM_TIMEZONE.into(),
            shortfall_default: ShortfallDefault::default(),
            countdown_reminder: true,
            timer_style: TimerStyle::default(),
            timer_display: TimerDisplay::default(),
            toggle_hotkey: "Ctrl+Shift+F12".into(),
            close_to_tray: true,
            silent_start: false,
            long_session_minutes: 180,
            show_calendar_legend: true,
            show_app_name: true,
            float_auto: true,
            float_hotkey: "Ctrl+Shift+F11".into(),
            float_form: FloatForm::default(),
            float_flow: FloatFlow::default(),
            float_progress: true,
            float_flip_progress: false,
            float_skin: FloatSkin::default(),
            float_scale: 100,
            float_pin_button: false,
            float_grip: false,
            float_dim: false,
            float_locked: false,
        }
    }
}

/// 悬浮窗大小的范围（百分比）
pub const FLOAT_SCALE_RANGE: std::ops::RangeInclusive<i64> = 80..=200;

impl Settings {
    fn validate(&self) -> AppResult<()> {
        validate_timezone(&self.timezone)?;
        if !(0..=24 * 60).contains(&self.long_session_minutes) {
            return Err(AppError::invalid("长时间计时提醒需在 0 ~ 1440 分钟之间"));
        }
        for hotkey in [&self.toggle_hotkey, &self.float_hotkey] {
            let hotkey = hotkey.trim();
            if hotkey.is_empty() || hotkey.chars().count() > 50 {
                return Err(AppError::invalid("快捷键格式不正确"));
            }
        }
        if !FLOAT_SCALE_RANGE.contains(&self.float_scale) {
            return Err(AppError::invalid("悬浮窗大小需在 80% ~ 200% 之间"));
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
        assert!(updated.countdown_reminder);
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
        assert!(settings.show_calendar_legend);
        assert!(settings.show_app_name);

        let updated = update(&conn, &json!({ "silentStart": true })).unwrap();
        assert!(updated.silent_start);
        assert_eq!(updated.timezone, "Asia/Shanghai");

        let updated = update(&conn, &json!({ "showCalendarLegend": false })).unwrap();
        assert!(!updated.show_calendar_legend);
        assert!(!get(&conn).unwrap().show_calendar_legend);
    }

    #[test]
    fn old_countdown_end_setting_becomes_reminder() {
        // 旧版的「自动暂停并提醒 / 继续计时」都改为「提醒，计时继续」
        for old in ["pause", "continue"] {
            let conn = conn();
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                params![
                    SETTINGS_KEY,
                    format!(r#"{{"countdownEnd":"{old}","timerStyle":"analog"}}"#)
                ],
            )
            .unwrap();
            let settings = get(&conn).unwrap();
            assert!(settings.countdown_reminder);
            assert_eq!(settings.timer_style, TimerStyle::Analog);

            // 保存后旧字段被移除，也不能再单独修改
            update(&conn, &json!({ "countdownReminder": false })).unwrap();
            let stored: String = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = ?1",
                    [SETTINGS_KEY],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(!stored.contains("countdownEnd"));
            assert!(!get(&conn).unwrap().countdown_reminder);
            assert!(update(&conn, &json!({ "countdownEnd": "pause" })).is_err());
        }
    }

    #[test]
    fn rejects_invalid_values() {
        let conn = conn();
        assert!(update(&conn, &json!({ "timezone": "Mars/Base" })).is_err());
        assert!(update(&conn, &json!({ "timerStyle": "sundial" })).is_err());
        assert!(update(&conn, &json!({ "unknownKey": 1 })).is_err());
        assert!(update(&conn, &json!({ "longSessionMinutes": -5 })).is_err());
        assert!(update(&conn, &json!("not an object")).is_err());
        assert!(update(&conn, &json!({ "floatScale": 79 })).is_err());
        assert!(update(&conn, &json!({ "floatScale": 201 })).is_err());
        assert!(update(&conn, &json!({ "floatForm": "capsule" })).is_err());
        assert!(update(&conn, &json!({ "floatHotkey": " " })).is_err());
        assert_eq!(get(&conn).unwrap(), Settings::default());
    }

    #[test]
    fn float_settings_default_and_update() {
        let conn = conn();
        // 旧版本保存的设置里没有悬浮窗字段，读出来是默认值
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params![SETTINGS_KEY, r#"{"timezone":"Asia/Shanghai"}"#],
        )
        .unwrap();
        let settings = get(&conn).unwrap();
        assert!(settings.float_auto);
        assert_eq!(settings.float_hotkey, "Ctrl+Shift+F11");
        assert_eq!(settings.float_form, FloatForm::Minimal);
        assert_eq!(settings.float_flow, FloatFlow::Ruler);
        assert!(settings.float_progress);
        assert!(!settings.float_flip_progress);
        assert_eq!(settings.float_scale, 100);

        let updated = update(
            &conn,
            &json!({
                "floatForm": "dial",
                "floatFlow": "minuteLine",
                "floatSkin": "light",
                "floatScale": 150,
                "floatLocked": true
            }),
        )
        .unwrap();
        assert_eq!(updated.float_form, FloatForm::Dial);
        assert_eq!(updated.float_flow, FloatFlow::MinuteLine);
        assert_eq!(updated.float_skin, FloatSkin::Light);
        assert_eq!(updated.float_scale, 150);
        assert!(updated.float_locked);
        assert_eq!(updated.timezone, "Asia/Shanghai");
    }

    #[test]
    fn float_skin_reads_values_saved_by_v0_2_6() {
        let conn = conn();
        for (saved, skin) in [("island", FloatSkin::Dark), ("follow", FloatSkin::System)] {
            let json = format!(r#"{{"timezone":"Asia/Shanghai","floatSkin":"{saved}"}}"#);
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT (key) DO UPDATE SET value = excluded.value",
                params![SETTINGS_KEY, json],
            )
            .unwrap();
            let settings = get(&conn).unwrap();
            assert_eq!(settings.float_skin, skin);
            // 其他设置照常读出，不会因为旧值退回默认
            assert_eq!(settings.timezone, "Asia/Shanghai");
        }
        assert_eq!(Settings::default().float_skin, FloatSkin::System);
    }
}
