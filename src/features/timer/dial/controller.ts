import type { TimerDisplay } from '../../../api/types';
import { type Bounds, type EngineMode, FeelEngine } from '../feel/engine';
import { DAMPED_WHEEL, type DialUnit, type FeelPreset, tickOmega } from '../feel/preset';
import { roundToward, springStep } from '../feel/spring';
import { displaySign } from '../readout';

/** 正在操作的是哪个表、哪个部件（用来高亮、决定徽标出现在哪） */
export type DialOwner = 'digital' | 'analog';

/** 服务端给的计时器数据（来自计时状态和当天详情） */
export interface DialServerState {
  planId: number | null;
  /** 今天目标（秒），没有目标为 0 */
  targetSeconds: number;
  display: TimerDisplay;
  /** 这个计划是否正在计时 */
  running: boolean;
  /** 截至 studiedAt 的今天已学（秒，已含手动修正） */
  studiedSeconds: number;
  studiedAt: number;
  /** 今天 0 点（毫秒），用来算今天已经过去多久 */
  dayStartMs: number;
}

/** 徽标：这一轮调整的合计 */
export interface BadgeState {
  visible: boolean;
  owner: DialOwner;
  /** 这一轮的合计（秒，已学方向），撤销后为 0 */
  sum: number;
  canUndo: boolean;
}

/** 每帧交给各个表去画的数据 */
export interface DialFrame {
  t: number;
  planId: number | null;
  /** 实际采用的显示方式：没有目标时倒计时退回正计时 */
  display: TimerDisplay;
  targetSeconds: number;
  /** 带走秒动画的已保存已学（电子计时器的数字带用） */
  learnedShown: number;
  /** 连续的已保存已学（指针用） */
  learnedLive: number;
  /** 显示上比已保存的多出来的秒数（已学方向） */
  offset: number;
  mode: EngineMode;
  unit: DialUnit;
  owner: DialOwner | null;
  part: string | null;
  /** 刚撞到的边界：-1 下限 / 1 上限 / 0 没有 */
  limit: number;
  badge: BadgeState;
}

type Listener = (frame: DialFrame) => void;

/** 控制器要调用的后端接口 */
export interface DialApi {
  stopTimer: () => Promise<unknown>;
  addCorrection: (planId: number, seconds: number, resume: boolean) => Promise<unknown>;
  /** 一批请求都完成后刷新数据 */
  refresh: () => Promise<unknown>;
  /** 请求失败时的处理，也可以之后用 setErrorHandler 设置 */
  onError?: (error: unknown) => void;
}

/** 一轮调整：停手约 5 秒没再碰就结束 */
const SESSION_MS = 5000;

/**
 * 计时器拖动的控制器（与 React 无关）。
 *
 * 显示不直接用服务端数据，而是本地时钟模型：已学 = base + (计时中 ? 现在 − baseAt : 0)。
 * 拖动、滚轮、撤销都先在本地生效，再按顺序把请求发给后端；手感引擎静止且没有未完成的请求时，
 * 才用服务端数据重新校准，避免数字跳回去。
 */
export class DialController {
  readonly engine: FeelEngine;
  private server: DialServerState | null = null;
  private serverDirty = false;
  private base = 0;
  private baseAt = 0;
  private running = false;
  private wasRunning = false;
  private sign: 1 | -1 = 1;
  private pending = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private shown = { value: 0, vel: 0, ready: false };
  private lastFrameAt: number | null = null;
  private session = {
    total: 0,
    touched: false,
    undone: false,
    lastAt: -Infinity,
    owner: 'digital' as DialOwner,
  };
  private owner: DialOwner | null = null;
  private part: string | null = null;
  private listeners = new Set<Listener>();
  private raf = 0;

  private readonly api: DialApi;
  private errorHandler: ((error: unknown) => void) | null = null;

  constructor(api: DialApi, preset: FeelPreset = DAMPED_WHEEL) {
    this.api = api;
    this.engine = new FeelEngine(preset);
  }

  /** 请求失败时怎么提示（界面层设置，例如弹出错误提示） */
  setErrorHandler(handler: (error: unknown) => void): void {
    this.errorHandler = handler;
  }

  // ---------- 数据 ----------

  /** 服务端数据变化时调用；只在静止且没有未完成请求时才拿来校准 */
  setServer(state: DialServerState): void {
    const planChanged = this.server?.planId !== state.planId;
    this.server = state;
    this.serverDirty = true;
    if (planChanged) {
      this.session = {
        ...this.session,
        total: 0,
        touched: false,
        undone: false,
        lastAt: -Infinity,
      };
      this.applyServer(true);
    }
  }

  private applyServer(jump: boolean): void {
    const s = this.server;
    if (!s) return;
    this.base = s.studiedSeconds;
    this.baseAt = s.studiedAt;
    this.running = s.running;
    this.serverDirty = false;
    if (jump || !this.shown.ready) {
      this.shown = { value: Math.floor(this.learnedAt(Date.now())), vel: 0, ready: true };
    }
  }

  /** 本地时钟模型下的今天已学（秒） */
  learnedAt(t: number): number {
    return this.base + (this.running ? Math.max(0, (t - this.baseAt) / 1000) : 0);
  }

  /** 显示上的今天已学（含正在拨动的部分） */
  displayedLearned(t: number): number {
    return this.learnedAt(t) + this.engine.offset;
  }

  private bounds(t: number): Bounds {
    const total = this.learnedAt(t);
    const elapsed = this.server ? (t - this.server.dayStartMs) / 1000 : Infinity;
    return { lo: -total, hi: Math.max(0, elapsed - total) };
  }

  private effectiveDisplay(): TimerDisplay {
    const s = this.server;
    return s && s.display === 'countDown' && s.targetSeconds > 0 ? 'countDown' : 'countUp';
  }

  /** 按顺序执行请求：计时操作必须一个接一个，避免「暂停」和「接着计时」顺序颠倒 */
  run(op: () => Promise<unknown>): Promise<void> {
    this.pending += 1;
    const next = this.queue
      .then(op)
      .catch((error: unknown) => (this.errorHandler ?? this.api.onError)?.(error))
      .finally(async () => {
        this.pending -= 1;
        if (this.pending === 0) {
          try {
            await this.api.refresh();
          } finally {
            this.serverDirty = true;
          }
        }
      });
    this.queue = next;
    return next.then(() => undefined);
  }

  // ---------- 操作 ----------

  /**
   * 按住某个部件开始拖：正在计时就先暂停（调整用掉的时间不计入）。
   * 后端虽然停了表，界面上仍当作在计时：松手接着计时之前不刷新数据，
   * 「暂停」按钮和顶部计时胶囊都保持原样。
   */
  grab(owner: DialOwner, part: string, unit: DialUnit, t: number): void {
    const planId = this.server?.planId;
    if (planId == null) return;
    if (this.engine.mode !== 'drag') {
      this.wasRunning = this.running;
      if (this.running) {
        this.base = this.learnedAt(t);
        this.baseAt = t;
        this.running = false;
        this.pending += 1;
        void this.run(() => this.api.stopTimer());
      }
    }
    this.owner = owner;
    this.part = part;
    this.session.owner = owner;
    const s = this.server;
    this.sign = s
      ? displaySign(this.effectiveDisplay(), s.targetSeconds, this.displayedLearned(t))
      : 1;
    this.engine.grab(unit, t);
  }

  /** 拖动：seconds 是表上的数变化了多少（往上为正） */
  drag(seconds: number, t: number): void {
    this.engine.dragBy(seconds * this.sign, t, this.bounds(t));
  }

  /** 松手：落点当场记成修正；按住前在计时的话马上接着走 */
  release(t: number): void {
    if (this.engine.mode !== 'drag') return;
    const landing = this.engine.release(t, this.bounds(t));
    const resume = this.wasRunning;
    this.wasRunning = false;
    this.land(landing, t);
    if (resume) {
      this.running = true;
      this.baseAt = t;
    }
    const planId = this.server?.planId;
    if (planId != null && (landing !== 0 || resume)) {
      void this.run(() => this.api.addCorrection(planId, landing, resume));
    }
    // 接着计时的请求已经排上，放开按住时对刷新的拦截
    if (resume) this.pending -= 1;
  }

  /** 滚轮、方向键：表上的数加减 steps 格（计时不停） */
  nudge(owner: DialOwner, part: string, unit: DialUnit, steps: number, t: number): void {
    const s = this.server;
    if (!s || s.planId == null || this.engine.mode === 'drag') return;
    const sign = displaySign(this.effectiveDisplay(), s.targetSeconds, this.displayedLearned(t));
    const landing = this.engine.nudge(unit, steps * sign, t, this.bounds(t));
    this.owner = owner;
    this.part = part;
    this.session.owner = owner;
    if (landing === 0) return;
    this.land(landing, t);
    const planId = s.planId;
    void this.run(() => this.api.addCorrection(planId, landing, false));
  }

  /** 撤销这一轮：修正退回去，数字从现在的位置平滑滑回去（计时不停） */
  undo(): void {
    const s = this.server;
    const total = this.session.total;
    if (!s || s.planId == null || total === 0 || this.engine.mode === 'drag') return;
    this.base -= total;
    this.shown.value -= total;
    this.engine.rewind(total);
    this.owner = null;
    this.part = null;
    this.session.total = 0;
    this.session.undone = true;
    this.session.lastAt = Date.now();
    const planId = s.planId;
    void this.run(() => this.api.addCorrection(planId, -total, false));
  }

  private land(landing: number, t: number): void {
    this.session.touched = true;
    this.session.undone = false;
    this.session.lastAt = t;
    if (landing === 0) return;
    this.base += landing;
    this.shown.value += landing;
    this.session.total += landing;
  }

  // ---------- 每帧 ----------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.raf) return;
    const loop = () => {
      this.tick(Date.now());
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** 推进一帧并通知各个表（测试里可以直接调用） */
  tick(t: number): DialFrame | null {
    const dt =
      this.lastFrameAt === null ? 0 : Math.min(0.05, Math.max(0, (t - this.lastFrameAt) / 1000));
    this.lastFrameAt = t;
    this.engine.step(t);
    if (this.engine.mode === 'idle') {
      this.owner = null;
      this.part = null;
      if (this.serverDirty && this.pending === 0) this.applyServer(false);
    }
    if (!this.server || !this.shown.ready) return null;

    // 走秒：显示值用弹簧追着已保存的整秒，起步和停下都是柔和的
    const target = Math.floor(this.learnedAt(t) + 1e-6);
    const omega = tickOmega(this.engine.preset);
    if (!Number.isFinite(omega)) {
      this.shown.value = target;
      this.shown.vel = 0;
    } else {
      const [x, v] = springStep(this.shown.value - target, this.shown.vel, omega, dt);
      this.shown.value = target + x;
      this.shown.vel = v;
    }

    const frame: DialFrame = {
      t,
      planId: this.server.planId,
      display: this.effectiveDisplay(),
      targetSeconds: this.server.targetSeconds,
      learnedShown: this.shown.value,
      learnedLive: this.learnedAt(t),
      offset: this.engine.offset,
      mode: this.engine.mode,
      unit: this.engine.unit,
      owner: this.owner,
      part: this.part,
      limit: t - this.engine.limitAt < 1600 ? this.engine.limit : 0,
      badge: this.badge(t),
    };
    for (const listener of this.listeners) listener(frame);
    return frame;
  }

  private badge(t: number): BadgeState {
    const session = this.session;
    const engine = this.engine;
    const dragging = engine.mode === 'drag';
    if (engine.mode !== 'idle') session.lastAt = t;
    const linger = session.total === 0 ? 1200 : SESSION_MS;
    if (engine.mode === 'idle' && t - session.lastAt > linger) {
      session.total = 0;
      session.touched = false;
      session.undone = false;
    }
    if (dragging) session.undone = false;
    // 正在拖的那一下按那一栏取整，加上这一轮已经记下的
    const live = dragging ? roundToward(engine.hand / engine.unit, engine.dir) * engine.unit : 0;
    const sum = session.undone ? 0 : session.total + live;
    const visible = dragging
      ? session.touched || Math.abs(live) >= 0.5
      : session.touched || session.undone;
    return {
      visible,
      owner: session.owner,
      sum,
      canUndo: visible && !dragging && !session.undone && session.total !== 0,
    };
  }
}
