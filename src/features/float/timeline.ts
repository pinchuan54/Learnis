/** 悬浮窗上的读数和今天进度的时间线（纯计算，配单元测试） */

/** 正计时（今天已学）或倒计时（今日目标 − 已学） */
export type FloatMode = 'up' | 'down';

export const pad2 = (value: number) => String(value).padStart(2, '0');

/** H:MM:SS，不到 1 小时为 M:SS；小圆表（short）只到「时:分」，秒在下面单独一行 */
export function formatClock(seconds: number, short = false): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (short) return `${h}:${pad2(m)}`;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/**
 * 表上显示的秒数：正计时是已学；倒计时是还剩多少，学过目标后是超出的部分
 * （over 为真：前面加「+」、变成超时橙，和主窗口的计时器一致）
 */
export function reading(studied: number, target: number, mode: FloatMode) {
  if (mode === 'up') return { seconds: studied, over: false };
  const left = target - studied;
  return { seconds: Math.abs(left), over: left < 0 };
}

/** 超出目标后最多加深到第几层 */
const EXTRA_LEVELS = 3;

/**
 * 今天的进度是一条时间线，「现在」在 p（0 ~ 1）处，永远从左往右走：
 * - 正计时亮 [0, p]（走过的）；倒计时（drain）亮 [p, 1]（还剩的）；
 * - 学过目标后，超出的时间按今天的目标一轮一轮算（目标 3 小时，多学的每 3 小时是一轮）：
 *   每一轮从左边涨满，level 是这一轮颜色的深浅（1 ~ 3 层，到顶不再加深）；
 *   under 是垫在下面的整条：上一轮的颜色（1 ~ 2），第一轮正计时垫着学满的计划色（-1），倒计时是空的（0）；
 * - 今天没有目标时：没学过就是空的，学了就算第一轮学满。
 */
export function timeline(studied: number, target: number, mode: FloatMode) {
  if (studied > target) {
    const round = target > 0 ? Math.floor((studied - target) / target) : 0;
    return {
      p: target > 0 ? ((studied - target) % target) / target : 1,
      drain: false,
      level: Math.min(round + 1, EXTRA_LEVELS),
      under: round > 0 ? Math.min(round, EXTRA_LEVELS - 1) : mode === 'up' && target > 0 ? -1 : 0,
    };
  }
  const p = target > 0 ? studied / target : mode === 'down' ? 1 : 0;
  return { p, drain: mode === 'down', level: 0, under: 0 };
}

/** 液体 / 细线的位移：整条宽度为 100%，正计时从左边伸出来，倒计时从「现在」往右铺 */
export function liquidShift(p: number, drain: boolean): string {
  return `translateX(${(drain ? p : p - 1) * 100}%)`;
}

/** 进度环（路径长 100）：正计时从 12 点画到「现在」，倒计时从「现在」画到 12 点 */
export function arcStyle(p: number, drain: boolean) {
  const length = drain ? 1 - p : p;
  return {
    strokeDashoffset: drain ? -p * 100 : 100 - p * 100,
    opacity: length === 0 ? 0 : undefined,
  };
}
