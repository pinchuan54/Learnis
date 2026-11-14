/**
 * 日期工具。日期统一用 `YYYY-MM-DD` 字符串（即「日期键」），只做纯日历运算，
 * 不涉及时区；「今天是哪天」以后端返回的 `today` 为准。
 * 涉及具体时刻（学习记录的起止时间）时，显式传入设置中的时区。
 */

export interface DateParts {
  year: number;
  /** 1 ~ 12 */
  month: number;
  day: number;
}

export const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日'] as const;
const WEEKDAY_LONG = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

export function parseDateKey(key: string): DateParts {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function toDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toUtcDate(key: string): Date {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(date: Date): string {
  return toDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(key: string, days: number): string {
  const date = toUtcDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtcDate(date);
}

/** 两个日期相差的天数（b - a） */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcDate(b).getTime() - toUtcDate(a).getTime()) / 86_400_000);
}

/** 星期序号：0 = 周一 … 6 = 周日（与学习日掩码一致） */
export function weekdayIndex(key: string): number {
  return (toUtcDate(key).getUTCDay() + 6) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** 月历网格：从包含 1 号的那一周的周一开始，共 6 周 42 天 */
export function monthGrid(year: number, month: number): string[] {
  const first = toDateKey(year, month, 1);
  const start = addDays(first, -weekdayIndex(first));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function formatMonthTitle(year: number, month: number): string {
  return `${year}年${month}月`;
}

/** `11月13日`；传入 today 且不在同一年时带年份：`2027年6月1日` */
export function formatShortDate(key: string, today?: string): string {
  const { year, month, day } = parseDateKey(key);
  if (today && parseDateKey(today).year !== year) return `${year}年${month}月${day}日`;
  return `${month}月${day}日`;
}

/** `11月13日 星期五`；跨年时带年份 */
export function formatDayLabel(key: string, today?: string): string {
  const { year, month, day } = parseDateKey(key);
  const sameYear = !today || parseDateKey(today).year === year;
  const date = sameYear ? `${month}月${day}日` : `${year}年${month}月${day}日`;
  return `${date} ${WEEKDAY_LONG[weekdayIndex(key)]}`;
}

/** 相对今天的称呼：今天 / 明天 / 昨天，其余返回 null */
export function relativeDayName(key: string, today: string): string | null {
  const diff = diffDays(today, key);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  return null;
}

// ---------- 带时区的时刻 ----------

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedParts(ms: number, timeZone: string) {
  const parts = offsetFormatter(timeZone).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** 某时刻在指定时区相对 UTC 的偏移（毫秒） */
function offsetAt(ms: number, timeZone: string): number {
  const seconds = Math.floor(ms / 1000) * 1000;
  const p = zonedParts(seconds, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - seconds;
}

/** 某时刻在指定时区的 `HH:mm` */
export function formatTimeOfDay(ms: number, timeZone: string): string {
  const p = zonedParts(ms, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** 某时刻在指定时区属于哪一天 */
export function dateKeyOf(ms: number, timeZone: string): string {
  const p = zonedParts(ms, timeZone);
  return toDateKey(p.year, p.month, p.day);
}

/** 指定时区的「日期 + HH:mm」→ UTC 毫秒 */
export function zonedTimeToMs(key: string, time: string, timeZone: string): number {
  const { year, month, day } = parseDateKey(key);
  const [hour, minute] = time.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetAt(guess, timeZone);
  const second = guess - offsetAt(first, timeZone);
  return second;
}
