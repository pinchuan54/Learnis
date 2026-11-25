//! 与前端交换的数据结构（字段统一用 camelCase 序列化）。

use serde::{Deserialize, Serialize};

/// 学习计划
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub id: i64,
    pub name: String,
    /// 想达到的水平 / 目标说明
    pub goal: String,
    pub color: String,
    pub total_minutes: i64,
    pub start_date: String,
    pub end_date: String,
    /// 学习日位掩码：bit0 = 周一 … bit6 = 周日
    pub study_weekdays: u8,
    pub archived: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 新建 / 编辑计划的输入
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanInput {
    pub name: String,
    #[serde(default)]
    pub goal: String,
    #[serde(default = "default_color")]
    pub color: String,
    pub total_minutes: i64,
    pub start_date: String,
    pub end_date: String,
    pub study_weekdays: u8,
}

fn default_color() -> String {
    "blue".into()
}

/// 计划列表项：计划 + 累计进度
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanSummary {
    #[serde(flatten)]
    pub plan: Plan,
    /// 累计学习时长（含超额、含正在进行的计时）
    pub studied_seconds: i64,
    /// 期限内的学习日数量
    pub study_day_count: i64,
}

/// 新建计划前的分配预览
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AllocationPreview {
    pub study_day_count: i64,
    pub min_daily_minutes: i64,
    pub max_daily_minutes: i64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SessionSource {
    Timer,
    Manual,
}

impl SessionSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Timer => "timer",
            Self::Manual => "manual",
        }
    }

    pub fn parse(value: &str) -> Self {
        if value == "manual" {
            Self::Manual
        } else {
            Self::Timer
        }
    }
}

/// 学习记录
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: i64,
    pub plan_id: i64,
    pub start_at: i64,
    /// 为空表示正在计时
    pub end_at: Option<i64>,
    pub source: SessionSource,
    pub note: String,
}

/// 手动修正：在计时器上拖动调整的学习时长，每个计划每天一笔净值
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Correction {
    pub plan_id: i64,
    pub date: String,
    /// 秒，正数是多学、负数是少学
    pub seconds: i64,
}

/// 补录 / 修改学习记录的输入
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInput {
    pub plan_id: i64,
    pub start_at: i64,
    pub end_at: i64,
    #[serde(default)]
    pub note: String,
}

/// 计时器状态
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerStatus {
    pub now_ms: i64,
    pub today: String,
    /// 正在进行的计时
    pub running: Option<Session>,
    /// 正在计时的计划今天的目标与已学；不在计时时是最近使用的计划（没有计划则为空）
    /// 用到它的地方要先看 `running`：顶栏胶囊、托盘提示只在计时中显示
    pub plan_today: Option<PlanDayProgress>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanDayProgress {
    pub plan_id: i64,
    pub target_minutes: i64,
    /// 截至 now_ms 的已学时长
    pub studied_seconds: i64,
}

/// 未达标时长的处理方式
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AdjustMode {
    /// 均分到后续学习日
    Spread,
    /// 拆分到指定日子
    Split,
    /// 全部加到下一个学习日
    NextDay,
}

impl AdjustMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Spread => "spread",
            Self::Split => "split",
            Self::NextDay => "next_day",
        }
    }

    pub fn parse(value: &str) -> Self {
        match value {
            "split" => Self::Split,
            "next_day" => Self::NextDay,
            _ => Self::Spread,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdjustItem {
    pub date: String,
    pub minutes: i64,
}

/// 调整请求：把某计划某天的若干分钟挪走
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustRequest {
    pub plan_id: i64,
    pub from_date: String,
    pub minutes: i64,
    pub mode: AdjustMode,
    /// 仅 `split` 使用：每段放到哪天、多少分钟
    #[serde(default)]
    pub items: Vec<AdjustItem>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Adjustment {
    pub id: i64,
    pub plan_id: i64,
    pub from_date: String,
    pub mode: AdjustMode,
    pub auto: bool,
    pub items: Vec<AdjustItem>,
    pub created_at: i64,
}

/// 挂起待处理的未达标时长
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PendingShortfall {
    pub plan_id: i64,
    pub plan_name: String,
    pub date: String,
    pub minutes: i64,
}

/// 待办
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub date: String,
    pub plan_id: Option<i64>,
    pub title: String,
    pub done: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoInput {
    pub date: String,
    #[serde(default)]
    pub plan_id: Option<i64>,
    pub title: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoPatch {
    pub title: Option<String>,
    pub done: Option<bool>,
    /// `Some(None)` 表示取消关联计划
    #[serde(default, with = "double_option")]
    pub plan_id: Option<Option<i64>>,
}

/// 区分「字段缺省」和「显式传 null」
mod double_option {
    use serde::{Deserialize, Deserializer};

    pub fn deserialize<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
    where
        D: Deserializer<'de>,
        T: Deserialize<'de>,
    {
        Option::<T>::deserialize(deserializer).map(Some)
    }
}

/// 某计划在某天的情况
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DayPlanEntry {
    pub plan_id: i64,
    pub name: String,
    pub color: String,
    /// 当天是否为该计划的学习日（在期限内且勾选了这一天）
    pub is_study_day: bool,
    /// 实际目标 = 基础分配 - 调出 + 调入
    pub target_minutes: i64,
    pub base_minutes: i64,
    pub incoming_minutes: i64,
    pub outgoing_minutes: i64,
    pub studied_seconds: i64,
    /// 已过去的日子里尚未处理的未达标分钟数
    pub pending_minutes: i64,
}

/// 月历中一天的状态，决定进度环的颜色
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DayStatus {
    /// 没有目标也没有学习
    Rest,
    /// 以后的日子
    Future,
    /// 今天，还没学够
    Progress,
    /// 学够了目标
    Done,
    /// 多学：已学的小时数（按月历显示的 1 位小数）比目标大，或没有目标却学了
    Overtime,
    /// 过去的日子没学够，还有挂起的时长
    Missed,
}

/// 月历中的一天
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DayCell {
    pub date: String,
    pub target_minutes: i64,
    pub studied_seconds: i64,
    /// 当天有目标或有学习记录的计划数量
    pub plan_count: i64,
    /// 当天的时长是否被调整过（调入或调出）
    pub adjusted: bool,
    pub pending_minutes: i64,
    pub status: DayStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthOverview {
    pub year: i32,
    pub month: u32,
    pub today: String,
    pub days: Vec<DayCell>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayDetail {
    pub date: String,
    pub today: String,
    pub plans: Vec<DayPlanEntry>,
    pub sessions: Vec<Session>,
    /// 这天的手动修正
    pub corrections: Vec<Correction>,
    pub todos: Vec<Todo>,
    pub adjustments: Vec<Adjustment>,
}

/// 当前时间信息（按设置中的时区）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Clock {
    pub now_ms: i64,
    pub today: String,
    /// 实际使用的 IANA 时区名
    pub timezone: String,
}
