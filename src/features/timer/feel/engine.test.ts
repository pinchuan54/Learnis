import { describe, expect, it } from 'vitest';
import { type Bounds, FeelEngine, unitOf } from './engine';

const FRAME = 1000 / 120;
const OPEN: Bounds = { lo: -1e9, hi: 1e9 };

/** 匀速拖动：从 t0 开始，每帧移动一点，共拖 seconds 秒（按显示值），用时 ms 毫秒 */
function drag(engine: FeelEngine, seconds: number, ms: number, t0: number, bounds = OPEN): number {
  const frames = Math.round(ms / FRAME);
  let t = t0;
  for (let i = 0; i < frames; i++) {
    t += FRAME;
    engine.dragBy(seconds / frames, t, bounds);
    engine.step(t);
  }
  return t;
}

/** 一直推进到静止，记录显示值（落点 + 剩余）的变化 */
function settle(engine: FeelEngine, landing: number, t0: number): number[] {
  const trace: number[] = [];
  let t = t0;
  for (let i = 0; i < 1200 && engine.mode !== 'idle'; i++) {
    t += FRAME;
    engine.step(t);
    trace.push(landing + engine.offset);
  }
  return trace;
}

describe('FeelEngine', () => {
  it('慢慢往上拖到一半松手：顺着方向进到上一格，一路往前、不倒退', () => {
    const engine = new FeelEngine();
    engine.grab(1, 0);
    engine.step(0);
    const t = drag(engine, 0.5, 500, 0);
    const before = engine.offset;
    const landing = engine.release(t, OPEN);
    expect(landing).toBe(1);
    const trace = settle(engine, landing, t);
    expect(engine.mode).toBe('idle');
    expect(trace.at(-1)).toBeCloseTo(1, 2);
    let previous = before;
    for (const value of trace) {
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(value).toBeLessThanOrEqual(1 + 1e-9);
      previous = value;
    }
  });

  it('甩得越快落得越远，按那一栏取整', () => {
    const slow = new FeelEngine();
    slow.grab(60, 0);
    const slowLanding = slow.release(drag(slow, 120, 400, 0), OPEN);
    const fast = new FeelEngine();
    fast.grab(60, 0);
    const fastLanding = fast.release(drag(fast, 120, 60, 0), OPEN);
    expect(slowLanding % 60).toBe(0);
    expect(fastLanding % 60).toBe(0);
    expect(fastLanding).toBeGreaterThan(slowLanding);
  });

  it('到边界停住，不会落到边界外', () => {
    const engine = new FeelEngine();
    const bounds: Bounds = { lo: -90.4, hi: 500 };
    engine.grab(60, 0);
    const t = drag(engine, -600, 300, 0, bounds);
    expect(engine.hand).toBe(-90.4);
    expect(engine.limit).toBe(-1);
    expect(engine.release(t, bounds)).toBe(-90);
  });

  it('滚轮按格落下，碰到边界时截住', () => {
    const engine = new FeelEngine();
    expect(engine.nudge(60, 2, 0, OPEN)).toBe(120);
    expect(engine.mode).toBe('settle');
    expect(engine.offset).toBe(-120);
    const limited = new FeelEngine();
    expect(limited.nudge(3600, -1, 0, { lo: -1800, hi: 0 })).toBe(-1800);
  });

  it('撤销时显示位置不变，再平滑滑回去', () => {
    const engine = new FeelEngine();
    engine.rewind(-180);
    expect(engine.offset).toBe(-180);
    expect(engine.unit).toBe(60);
    settle(engine, 0, 0);
    expect(engine.mode).toBe('idle');
    expect(engine.offset).toBe(0);
  });

  it('修正量按整时、整分、秒对应到那一栏', () => {
    expect(unitOf(7200)).toBe(3600);
    expect(unitOf(-180)).toBe(60);
    expect(unitOf(45)).toBe(1);
  });
});
