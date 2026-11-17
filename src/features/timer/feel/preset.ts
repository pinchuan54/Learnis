/** 一格是多少秒：秒 1、分 60、时 3600 */
export type DialUnit = 1 | 60 | 3600;

/**
 * 手感预设（#34 的「手感」层）。数值用原型 `prototypes/timer-drag` 调出来定稿。
 */
export interface FeelPreset {
  /** 拖动速度：数字移动距离和鼠标移动距离之比，1 就是完全跟手 */
  speed: Record<DialUnit, number>;
  /** 快拖加速：拖得很快时额外多走几格，0 不加速 */
  accel: number;
  /** 滚轮每滚一格走几格 */
  wheel: Record<DialUnit, number>;
  /** 重量感：显示值追上鼠标大约要多少毫秒 */
  weightMs: number;
  /** 松手后滑行：0 ~ 100，越大滑得越远 */
  glide: number;
  /** 甩出力度：同样的甩速转出去多少 */
  fling: number;
  /** 走秒动画时长（毫秒），1 秒以上时数字会一直缓缓地走 */
  tickMs: number;
}

/** 「阻尼滚轮」：第一版唯一的手感预设，电子计时器和物理秒表共用 */
export const DAMPED_WHEEL: FeelPreset = {
  speed: { 1: 0.99, 60: 0.6, 3600: 1.05 },
  accel: 0.5,
  wheel: { 1: 0.7, 60: 0.7, 3600: 0.5 },
  weightMs: 80,
  glide: 35,
  fling: 0.6,
  tickMs: 1397,
};

/** 松手后滑行换算成衰减时间常数（秒）：0 约 0.06 秒，50 约 0.3 秒，100 约 1.5 秒 */
export const glideTau = (preset: FeelPreset): number =>
  0.06 * Math.pow(1.5 / 0.06, preset.glide / 100);

/** 没有速度、只是吸附到整格时的时间常数（秒），越沉吸附得越慢 */
export const snapTau = (preset: FeelPreset): number => 0.1 + (preset.weightMs / 1000) * 0.4;

/** 重量感对应的弹簧系数：匀速拖动时显示值大约落后「重量感」那么多毫秒 */
export const followOmega = (preset: FeelPreset): number =>
  preset.weightMs > 0 ? 2000 / preset.weightMs : Infinity;

/** 走秒弹簧系数：临界阻尼弹簧大约在 4.74/ω 秒走完 95%，让它等于走秒动画时长 */
export const tickOmega = (preset: FeelPreset): number =>
  preset.tickMs > 0 ? 4.74 / (preset.tickMs / 1000) : Infinity;
