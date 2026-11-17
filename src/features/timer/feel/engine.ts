import {
  DAMPED_WHEEL,
  type DialUnit,
  type FeelPreset,
  followOmega,
  glideTau,
  snapTau,
} from './preset';
import { roundToward, springStep } from './spring';

/** 拨动秒数的上下界（相对当前合计）：今天合计不低于 0，不超过今天已经过去的时长 */
export interface Bounds {
  lo: number;
  hi: number;
}

export type EngineMode = 'idle' | 'drag' | 'settle';

/** 修正量对应的那一栏：整小时的按时，整分钟的按分，其余按秒 */
export function unitOf(seconds: number): DialUnit {
  if (seconds % 3600 === 0) return 3600;
  if (seconds % 60 === 0) return 60;
  return 1;
}

/**
 * 手感引擎：只处理「一个数」——这次拨动了多少秒，和计时器长什么样无关（#34 的「手感」层）。
 *
 * - drag：按住拖动，显示值（offset）带重量感地追着手（hand）
 * - settle：松手时就算出落点并交给调用方记下，显示上剩下的那一点带着当时的速度平滑归零，
 *   和正常走秒叠在一起，所以不会先停一下再走
 *
 * 时间 t 都是毫秒（同一个时钟即可）。
 */
export class FeelEngine {
  mode: EngineMode = 'idle';
  unit: DialUnit = 1;
  /** 手拨到的秒数（相对按住时的合计） */
  hand = 0;
  /** 显示比实际合计多出来的秒数 */
  offset = 0;
  /** offset 的速度（秒 / 秒），保证松手前后速度连续 */
  vel = 0;
  /** 最后一次移动的方向：1 往上加，-1 往下减 */
  dir = 0;
  /** 最近一次落下（记成修正）的秒数 */
  landing = 0;
  /** 最近撞到的边界：-1 下限 / 1 上限，limitAt 是撞到的时间 */
  limit = 0;
  limitAt = -Infinity;

  private omega = 0;
  private samples: [number, number][] = [];
  private lastStep: number | null = null;

  readonly preset: FeelPreset;

  constructor(preset: FeelPreset = DAMPED_WHEEL) {
    this.preset = preset;
  }

  /** 按住：上一次还在收尾的话，从当前显示的位置接着拖 */
  grab(unit: DialUnit, t: number): void {
    this.mode = 'drag';
    this.unit = unit;
    this.hand = this.offset;
    this.dir = 0;
    this.samples = [[t, this.hand]];
  }

  dragBy(seconds: number, t: number, bounds: Bounds): void {
    if (this.mode !== 'drag') return;
    if (seconds !== 0) this.dir = Math.sign(seconds);
    this.hand = this.clamp(this.hand + seconds, bounds, t);
    this.samples.push([t, this.hand]);
    while (this.samples.length > 2 && t - this.samples[0][0] > 100) this.samples.shift();
  }

  /** 松手：按手的速度估算会滑到哪，顺着最后的方向落到整格。返回落点（要记成修正的秒数） */
  release(t: number, bounds: Bounds): number {
    const samples = this.samples;
    let handVel = 0;
    if (samples.length >= 2) {
      const [t0, h0] = samples[0];
      const [t1, h1] = samples[samples.length - 1];
      if (t - t1 < 80 && t1 > t0) handVel = (h1 - h0) / ((t1 - t0) / 1000);
    }
    const natural = this.hand + handVel * this.preset.fling * glideTau(this.preset);
    const moving = Math.abs(this.vel) > 0.02 * this.unit ? Math.sign(this.vel) : 0;
    const dir = Math.sign(handVel) || moving || this.dir;
    const landing = this.clampLanding(roundToward(natural / this.unit, dir) * this.unit, bounds, t);
    this.beginSettle(landing);
    return landing;
  }

  /** 滚轮、方向键：直接落下 steps 格（计时不停）。返回落点，碰到边界时可能是 0 */
  nudge(unit: DialUnit, steps: number, t: number, bounds: Bounds): number {
    if (this.mode === 'drag') return 0;
    this.unit = unit;
    const landing = this.clampLanding(steps * unit, bounds, t);
    if (landing !== 0) this.beginSettle(landing);
    return landing;
  }

  /** 撤销：合计刚减掉 amount，显示位置不变，再平滑滑回去 */
  rewind(amount: number): void {
    if (this.mode === 'drag' || amount === 0) return;
    this.offset += amount;
    this.unit = unitOf(amount);
    this.landing = -amount;
    this.omega = (1 / snapTau(this.preset)) * 0.7;
    this.mode = 'settle';
  }

  /** 每帧推进：拖动时显示带重量感地追手；收尾时剩余部分平滑归零 */
  step(t: number): void {
    const dt = this.lastStep === null ? 0 : Math.min(0.05, Math.max(0, (t - this.lastStep) / 1000));
    this.lastStep = t;
    if (this.mode === 'drag') {
      const omega = followOmega(this.preset);
      if (!Number.isFinite(omega)) {
        const instant = dt > 0 ? (this.hand - this.offset) / dt : 0;
        this.vel = this.vel * 0.5 + instant * 0.5;
        this.offset = this.hand;
      } else {
        const [x, v] = springStep(this.offset - this.hand, this.vel, omega, dt);
        this.offset = this.hand + x;
        this.vel = v;
      }
    } else if (this.mode === 'settle') {
      const [x, v] = springStep(this.offset, this.vel, this.omega, dt);
      this.offset = x;
      this.vel = v;
      if (Math.abs(x) < 0.0015 && Math.abs(v) < 0.02) {
        this.mode = 'idle';
        this.offset = 0;
        this.vel = 0;
      }
    }
  }

  /** 实际合计刚加上 shift：显示位置不变，剩余 offset 相应减掉，再带着当前速度归零 */
  private beginSettle(shift: number): void {
    this.landing = shift;
    this.offset -= shift;
    this.hand = 0;
    const x = this.offset;
    const v = this.vel;
    // 朝目标运动时：系数不小于 |v|/|x|，起步速度不变且不冲过头、不回弹；
    // 也不小于 1/滑行时间，免得最后一点拖太久
    let omega = 1 / snapTau(this.preset);
    if (x * v < 0 && Math.abs(v) > 0.02 * this.unit) {
      omega = Math.min(400, Math.max(Math.abs(v) / Math.abs(x), 1 / glideTau(this.preset), 0.4));
    }
    this.omega = omega;
    this.mode = 'settle';
  }

  private clamp(value: number, bounds: Bounds, t: number): number {
    if (value <= bounds.lo) return this.hitLimit(-1, bounds.lo, t);
    if (value >= bounds.hi) return this.hitLimit(1, bounds.hi, t);
    return value;
  }

  private clampLanding(landing: number, bounds: Bounds, t: number): number {
    if (landing < bounds.lo) return this.hitLimit(-1, Math.ceil(bounds.lo), t);
    if (landing > bounds.hi) return this.hitLimit(1, Math.floor(bounds.hi), t);
    return landing;
  }

  private hitLimit(side: number, value: number, t: number): number {
    this.limit = side;
    this.limitAt = t;
    return value;
  }
}
