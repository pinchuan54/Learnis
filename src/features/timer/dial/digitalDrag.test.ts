import { describe, expect, it } from 'vitest';
import { DAMPED_WHEEL, type FeelPreset } from '../feel/preset';
import { digitalDragSeconds } from './digitalDrag';

/** 正式版电子计时器一格数字的高度：84px × 1.3 */
const ROW = 109.2;
const noAccel: FeelPreset = { ...DAMPED_WHEEL, accel: 0 };

describe('digitalDragSeconds', () => {
  it('速度 1 时往上拖一格的高度正好走一格（完全跟手）', () => {
    const preset: FeelPreset = { ...noAccel, speed: { 1: 1, 60: 1, 3600: 1 } };
    expect(digitalDragSeconds(-ROW, 1000, ROW, 1, preset)).toBeCloseTo(1);
    expect(digitalDragSeconds(-ROW, 1000, ROW, 60, preset)).toBeCloseTo(60);
    expect(digitalDragSeconds(-ROW, 1000, ROW, 3600, preset)).toBeCloseTo(3600);
  });

  it('往下拖为减', () => {
    expect(digitalDragSeconds(ROW, 1000, ROW, 1, noAccel)).toBeCloseTo(-0.99);
  });

  it('慢拖一格的高度按定稿速度走：秒 0.99 格、分 0.6 格、时 1.05 格', () => {
    // 1 秒拖过一格，约 0.11 像素 / 毫秒，不触发快拖加速
    expect(digitalDragSeconds(-ROW, 1000, ROW, 1, DAMPED_WHEEL)).toBeCloseTo(0.99);
    expect(digitalDragSeconds(-ROW, 1000, ROW, 60, DAMPED_WHEEL)).toBeCloseTo(0.6 * 60);
    expect(digitalDragSeconds(-ROW, 1000, ROW, 3600, DAMPED_WHEEL)).toBeCloseTo(1.05 * 3600);
  });

  it('拖得很快时按快拖加速多走', () => {
    // 10 毫秒拖 50 像素 = 5 像素 / 毫秒，加速 1 + 0.5 × (5 − 0.5) = 3.25 倍
    const slow = digitalDragSeconds(-50, 1000, ROW, 1, DAMPED_WHEEL);
    const fast = digitalDragSeconds(-50, 10, ROW, 1, DAMPED_WHEEL);
    expect(fast / slow).toBeCloseTo(3.25);
  });

  it('同样的鼠标距离，数字格越矮走得越多', () => {
    // dev.5 的问题：把整条数字带（秒十位 7 格）的高度当成一格，拖动慢了 7 倍
    const right = digitalDragSeconds(-ROW, 1000, ROW, 1, DAMPED_WHEEL);
    const wrong = digitalDragSeconds(-ROW, 1000, ROW * 7, 1, DAMPED_WHEEL);
    expect(right / wrong).toBeCloseTo(7);
  });
});
