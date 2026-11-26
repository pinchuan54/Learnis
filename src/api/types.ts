/**
 * 与 Rust 端 `src-tauri/src/domain/model.rs`、`settings.rs` 对应的数据类型。
 * 约定：日期为 `YYYY-MM-DD` 字符串，时间点为 UTC 毫秒，计划时长以分钟计，学习时长以秒计。
 */

/** 计划颜色名，前端映射到具体色值 */
export type PlanColor =
  'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'gray';

export interface Plan {
  id: number;
  name: string;
  /** 想达到的水平 / 目标说明 */
  goal: string;
  color: PlanColor;
  totalMinutes: number;
  startDate: string;
  endDate: string;
  /** 学习日位掩码：bit0 = 周一 … bit6 = 周日 */
  studyWeekdays: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PlanInput {
  name: string;
  goal: string;
  color: PlanColor;
  totalMinutes: number;
  startDate: string;
  endDate: string;
  studyWeekdays: number;
}

export interface PlanSummary extends Plan {
  /** 累计学习时长（含超额和正在进行的计时） */
  studiedSeconds: number;
  studyDayCount: number;
}

export interface AllocationPreview {
  studyDayCount: number;
  minDailyMinutes: number;
  maxDailyMinutes: number;
}

export type SessionSource = 'timer' | 'manual';

export interface Session {
  id: number;
  planId: number;
  startAt: number;
  /** 为空表示正在计时 */
  endAt: number | null;
  source: SessionSource;
  note: string;
}

export interface SessionInput {
  planId: number;
  startAt: number;
  endAt: number;
  note?: string;
}

export interface PlanDayProgress {
  planId: number;
  targetMinutes: number;
  studiedSeconds: number;
}

export interface TimerStatus {
  nowMs: number;
  today: string;
  running: Session | null;
  /** 正在计时的计划今天的目标与已学 */
  planToday: PlanDayProgress | null;
}

/** 未达标时长的处理方式：均分到后续学习日 / 拆分到指定日子 / 全加到下一个学习日 */
export type AdjustMode = 'spread' | 'split' | 'nextDay';

export interface AdjustItem {
  date: string;
  minutes: number;
}

export interface AdjustRequest {
  planId: number;
  fromDate: string;
  minutes: number;
  mode: AdjustMode;
  /** 仅 split 使用 */
  items?: AdjustItem[];
}

export interface Adjustment {
  id: number;
  planId: number;
  fromDate: string;
  mode: AdjustMode;
  /** 是否由默认处理方式自动生成 */
  auto: boolean;
  items: AdjustItem[];
  createdAt: number;
}

export interface PendingShortfall {
  planId: number;
  planName: string;
  date: string;
  minutes: number;
}

export interface Todo {
  id: number;
  date: string;
  planId: number | null;
  title: string;
  done: boolean;
  sortOrder: number;
}

export interface TodoInput {
  date: string;
  planId?: number | null;
  title: string;
}

export interface TodoPatch {
  title?: string;
  done?: boolean;
  /** 传 null 取消关联计划 */
  planId?: number | null;
}

export interface DayPlanEntry {
  planId: number;
  name: string;
  color: PlanColor;
  isStudyDay: boolean;
  /** 实际目标 = 基础分配 - 调出 + 调入 */
  targetMinutes: number;
  baseMinutes: number;
  incomingMinutes: number;
  outgoingMinutes: number;
  studiedSeconds: number;
  /** 过去的日子里尚未处理的未达标分钟数 */
  pendingMinutes: number;
}

/**
 * 月历中一天的状态（由后端计算）：休息 / 未开始 / 进行中 / 达标 / 多学 / 没学够。
 * 多学按月历显示的小时数判定：已学显示得比目标大，或没有目标却学了。
 */
export type DayStatus = 'rest' | 'future' | 'progress' | 'done' | 'overtime' | 'missed';

export interface DayCell {
  date: string;
  targetMinutes: number;
  studiedSeconds: number;
  planCount: number;
  adjusted: boolean;
  pendingMinutes: number;
  status: DayStatus;
}

export interface MonthOverview {
  year: number;
  month: number;
  today: string;
  days: DayCell[];
}

/** 手动修正：在计时器上拖动调整的学习时长，每个计划每天一笔净值 */
export interface Correction {
  planId: number;
  date: string;
  /** 秒，正数是多学、负数是少学 */
  seconds: number;
}

export interface DayDetail {
  date: string;
  today: string;
  plans: DayPlanEntry[];
  sessions: Session[];
  corrections: Correction[];
  todos: Todo[];
  adjustments: Adjustment[];
}

export interface Clock {
  nowMs: number;
  today: string;
  /** 实际使用的 IANA 时区名 */
  timezone: string;
}

export type ShortfallDefault = 'suspend' | 'spread' | 'nextDay';
export type TimerStyle = 'digital' | 'analog';
export type TimerDisplay = 'countDown' | 'countUp';

export interface Settings {
  /** `system` 或 IANA 时区名 */
  timezone: string;
  shortfallDefault: ShortfallDefault;
  /** 倒计时归零（今天的目标学完）时提醒，由用户选择继续或暂停；计时从不自动停下 */
  countdownReminder: boolean;
  timerStyle: TimerStyle;
  timerDisplay: TimerDisplay;
  toggleHotkey: string;
  closeToTray: boolean;
  /** 静默启动：开机自启时不显示窗口，只在托盘运行 */
  silentStart: boolean;
  /** 单次计时超过多少分钟提醒，0 表示不提醒 */
  longSessionMinutes: number;
  /** 月历下方显示图例（各颜色的含义） */
  showCalendarLegend: boolean;
  /** 顶部导航左上角显示应用名称（关闭后只显示标志） */
  showAppName: boolean;
  /** 计时中把主窗口关到托盘或最小化时，自动出现悬浮窗 */
  floatAuto: boolean;
  /** 显示 / 隐藏悬浮窗的全局快捷键 */
  floatHotkey: string;
  floatForm: FloatForm;
  floatFlow: FloatFlow;
  /** 极简、小圆表显示今天的进度 */
  floatProgress: boolean;
  /** 翻页底部的进度细线（单独设置，默认不显示） */
  floatFlipProgress: boolean;
  floatSkin: FloatSkin;
  /** 悬浮窗大小，百分比（80 ~ 200） */
  floatScale: number;
  /** 开始 / 暂停按钮一直显示（极简、翻页） */
  floatPinButton: boolean;
  /** 悬停时显示拖角（在贴边方向的对角） */
  floatGrip: boolean;
  /** 鼠标离开一会儿后变成半透明 */
  floatDim: boolean;
  /** 锁定位置，拖不动 */
  floatLocked: boolean;
}

/** 悬浮窗形态：极简 / 翻页 / 小圆表 */
export type FloatForm = 'minimal' | 'flip' | 'dial';

/** 悬浮窗的时间流逝感：刻度带 / 分钟线 / 秒脉搏 / 不显示 */
export type FloatFlow = 'ruler' | 'minuteLine' | 'pulse' | 'none';

/** 悬浮窗配色：白 / 黑 / 跟随系统（和 Learnis 的外观分开设置） */
export type FloatSkin = 'light' | 'dark' | 'system';

/** 等待用户处理的倒计时归零提醒 */
export interface CountdownReminder {
  /** 提醒针对的那次计时 */
  sessionId: number;
  planName: string;
  targetMinutes: number;
}

/** 可以更新到的新版本 */
export interface UpdateInfo {
  /** 新版本号，如 `0.1.3` */
  version: string;
  currentVersion: string;
  /** 更新说明（纯文本，可能有多行） */
  notes: string | null;
}

/** 下载更新的进度，单位字节 */
export interface UpdateProgress {
  downloaded: number;
  /** 服务器没给出文件大小时为 null */
  total: number | null;
}
