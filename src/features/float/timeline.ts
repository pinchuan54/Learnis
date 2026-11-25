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

/**
 * 今天的进度是一条时间线，「现在」在 p（0 ~ 1）处，永远从左往右走：
 * - 正计时亮 [0, p]（走过的）；倒计时（drain）亮 [p, 1]（还剩的）；
 * - 学过目标（extra）后变橙：正计时整条亮着，倒计时改成从左边累积超出的部分；
 * - 今天没有目标时：没学过就是空的，学了就算超出。
 */
export function timeline(studied: number, target: number, mode: FloatMode) {
  const extra = studied > target;
  const ratio = (value: number) => (target > 0 ? Math.min(value / target, 1) : value > 0 ? 1 : 0);
  if (mode === 'down' && extra) return { p: ratio(studied - target), drain: false, extra };
  if (mode === 'down') return { p: target > 0 ? ratio(studied) : 1, drain: true, extra };
  return { p: ratio(studied), drain: false, extra };
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
