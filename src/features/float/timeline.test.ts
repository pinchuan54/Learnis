import { describe, expect, it } from 'vitest';
import { arcStyle, formatClock, liquidShift, reading, timeline } from './timeline';

describe('formatClock', () => {
  it('不到 1 小时显示分:秒，之后显示时:分:秒', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(24 * 60 + 7)).toBe('24:07');
    expect(formatClock(3600 + 24 * 60 + 7)).toBe('1:24:07');
  });

  it('小圆表只到时:分，不到 1 小时也带 0:', () => {
    expect(formatClock(24 * 60 + 7, true)).toBe('0:24');
    expect(formatClock(3600 + 24 * 60 + 7, true)).toBe('1:24');
  });
});

describe('reading', () => {
  it('正计时显示已学', () => {
    expect(reading(500, 3600, 'up')).toEqual({ seconds: 500, over: false });
  });

  it('倒计时显示剩余，学过目标后显示超出并标出', () => {
    expect(reading(500, 3600, 'down')).toEqual({ seconds: 3100, over: false });
    expect(reading(3700, 3600, 'down')).toEqual({ seconds: 100, over: true });
  });
});

describe('timeline', () => {
  it('正计时亮走过的，倒计时亮还剩的，「现在」在同一处', () => {
    expect(timeline(900, 3600, 'up')).toEqual({ p: 0.25, drain: false, extra: false });
    expect(timeline(900, 3600, 'down')).toEqual({ p: 0.25, drain: true, extra: false });
  });

  it('学过目标后变橙：正计时整条亮，倒计时从左边累积超出的部分', () => {
    expect(timeline(4500, 3600, 'up')).toEqual({ p: 1, drain: false, extra: true });
    expect(timeline(4500, 3600, 'down')).toEqual({ p: 0.25, drain: false, extra: true });
  });

  it('今天没有目标：没学过是空的，学了算超出', () => {
    expect(timeline(0, 0, 'up')).toEqual({ p: 0, drain: false, extra: false });
    expect(timeline(0, 0, 'down')).toEqual({ p: 1, drain: true, extra: false });
    expect(timeline(60, 0, 'up')).toEqual({ p: 1, drain: false, extra: true });
    expect(timeline(60, 0, 'down')).toEqual({ p: 1, drain: false, extra: true });
  });
});

describe('液体和进度环', () => {
  it('正计时从左边伸出来，倒计时从「现在」往右铺', () => {
    expect(liquidShift(0.25, false)).toBe('translateX(-75%)');
    expect(liquidShift(0.25, true)).toBe('translateX(25%)');
  });

  it('进度环正计时画 12 点到现在，倒计时画现在到 12 点，长度为 0 时隐藏', () => {
    expect(arcStyle(0.25, false)).toEqual({ strokeDashoffset: 75, opacity: undefined });
    expect(arcStyle(0.25, true)).toEqual({ strokeDashoffset: -25, opacity: undefined });
    expect(arcStyle(0, false).opacity).toBe(0);
    expect(arcStyle(1, true).opacity).toBe(0);
  });
});
