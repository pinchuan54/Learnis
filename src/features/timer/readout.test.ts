import { describe, expect, it } from 'vitest';
import { computeReadout, displaySign } from './readout';

const HOUR = 3600;

describe('computeReadout', () => {
  it('倒计时显示剩余时长', () => {
    expect(computeReadout('countDown', 5 * HOUR, 0.5 * HOUR)).toEqual({
      mode: 'countDown',
      seconds: 4.5 * HOUR,
      label: '剩余',
      overtime: false,
    });
  });

  it('倒计时归零后显示额外学习', () => {
    const readout = computeReadout('countDown', 5 * HOUR, 5 * HOUR + 600);
    expect(readout.overtime).toBe(true);
    expect(readout.seconds).toBe(600);
    expect(readout.label).toBe('额外学习');
  });

  it('正计时显示今天已学，切换前后数值吻合', () => {
    const down = computeReadout('countDown', 5 * HOUR, 0.5 * HOUR);
    const up = computeReadout('countUp', 5 * HOUR, 0.5 * HOUR);
    expect(up.seconds).toBe(0.5 * HOUR);
    expect(down.seconds + up.seconds).toBe(5 * HOUR);
  });

  it('没有目标时倒计时退回正计时', () => {
    const readout = computeReadout('countDown', 0, 120);
    expect(readout.mode).toBe('countUp');
    expect(readout.overtime).toBe(false);
  });
});

describe('displaySign', () => {
  it('倒计时的剩余往上拨等于少学', () => {
    expect(displaySign('countDown', 5 * HOUR, HOUR)).toBe(-1);
  });

  it('正计时、额外学习、没有目标时往上拨都是多学', () => {
    expect(displaySign('countUp', 5 * HOUR, HOUR)).toBe(1);
    expect(displaySign('countDown', 5 * HOUR, 6 * HOUR)).toBe(1);
    expect(displaySign('countDown', 0, HOUR)).toBe(1);
  });
});
