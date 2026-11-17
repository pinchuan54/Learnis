import type { TimerDisplay } from '../../../api/types';
import { mod } from '../feel/spring';

/** 电子计时器的每一位：一格多少秒、几进制（时十位、时个位、分十位、分个位、秒十位、秒个位） */
export const DIGIT_REELS = [
  { unit: 36000, base: 10 },
  { unit: 3600, base: 10 },
  { unit: 600, base: 6 },
  { unit: 60, base: 10 },
  { unit: 10, base: 6 },
  { unit: 1, base: 10 },
] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * 每一位数字带的位置（0 ~ 进制，小数表示正在滚动）。像里程表：低位滚过最后一格时，高位在这一格里跟着进位。
 *
 * - base：表上已保存的数（秒，带走秒动画的小数）
 * - offset：正在拨动、还没归零的秒数（与表上的数同方向）
 * - activeUnit：正在拨的那一栏一格多少秒；这一栏及更高位按它连续滚动，更低位不受拨动影响，照常走秒
 */
export function reelPositions(base: number, offset: number, activeUnit: number): number[] {
  let unit = activeUnit;
  const total = base + offset;
  let high = total;
  if (unit > 1) {
    const carry = clamp01(mod(base, unit) - (unit - 1));
    high = (Math.floor(base / unit) + carry) * unit + offset;
    // 拨到接近 0 时低位已经不够减，改成按合计整体显示
    if (high < 0) {
      unit = 1;
      high = total;
    }
  }
  high = Math.max(0, high);
  return DIGIT_REELS.map((reel) => {
    const value = reel.unit >= unit ? high : Math.max(0, base);
    const window = reel.unit >= unit ? unit : 1;
    const whole = Math.floor(value / reel.unit);
    const frac = clamp01((value - whole * reel.unit - (reel.unit - window)) / window);
    return mod(whole, reel.base) + frac;
  });
}

/**
 * 把「今天已学」换成表上的数：倒计时显示剩余，超过目标后显示额外学习；正计时显示已学。
 * learnedBase 是已保存的已学，learnedOffset 是正在拨动的部分；返回值的 offset 与表上的数同方向。
 */
export function dialValues(
  mode: TimerDisplay,
  targetSeconds: number,
  learnedBase: number,
  learnedOffset: number,
): { base: number; offset: number; over: boolean } {
  const over = targetSeconds > 0 && learnedBase + learnedOffset > targetSeconds;
  if (mode !== 'countDown' || targetSeconds <= 0) {
    return { base: learnedBase, offset: learnedOffset, over };
  }
  return over
    ? { base: learnedBase - targetSeconds, offset: learnedOffset, over }
    : { base: targetSeconds - learnedBase, offset: -learnedOffset, over };
}

/** 徽标上的各位：时十位、时个位、冒号、分十位、分个位、冒号、秒十位、秒个位 */
export const BADGE_SLOTS = ['h10', 'h1', 'c1', 'm10', 'm1', 'c2', 's10', 's1'] as const;
export type BadgeSlot = (typeof BADGE_SLOTS)[number];

/** 徽标上的时间拆成各位：不到一小时不显示小时，不到十分钟（且没有小时）不显示分十位 */
export function badgeDigits(seconds: number): {
  digits: Record<BadgeSlot, number>;
  visible: Record<BadgeSlot, boolean>;
} {
  const s = Math.abs(Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const sec = s % 60;
  return {
    digits: {
      h10: Math.floor(h / 10) % 10,
      h1: h % 10,
      c1: 0,
      m10: Math.floor(m / 10),
      m1: m % 10,
      c2: 0,
      s10: Math.floor(sec / 10),
      s1: sec % 10,
    },
    visible: {
      h10: h >= 10,
      h1: h > 0,
      c1: h > 0,
      m10: h > 0 || m >= 10,
      m1: true,
      c2: true,
      s10: true,
      s1: true,
    },
  };
}
