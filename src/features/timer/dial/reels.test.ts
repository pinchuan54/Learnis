import { describe, expect, it } from 'vitest';
import { badgeDigits, dialValues, reelPositions } from './reels';

const round = (values: number[]) => values.map((v) => Math.round(v * 1000) / 1000);

describe('reelPositions', () => {
  it('静止时每一位就是对应的数字', () => {
    // 00:53:27
    expect(round(reelPositions(3207, 0, 1))).toEqual([0, 0, 5, 3, 2, 7]);
  });

  it('走秒进位：最后一秒里所有要进位的数字一起滚', () => {
    // 00:59:59.5 → 01:00:00 过半
    expect(round(reelPositions(3599.5, 0, 1))).toEqual([0, 0.5, 5.5, 9.5, 5.5, 9.5]);
  });

  it('拖「分」时秒位不动，分钟连续滚动', () => {
    expect(round(reelPositions(3207, 150, 60))).toEqual([0, 0, 5, 5.5, 2, 7]);
  });

  it('拖「分」越过 59：小时跟着进位', () => {
    expect(round(reelPositions(3207, 420, 60))).toEqual([0, 1, 0, 0, 2, 7]);
  });

  it('往回拨借位，拨到 0 时整体归零', () => {
    expect(round(reelPositions(3207, -1800, 3600))).toEqual([0, 0, 2, 3, 2, 7]);
    expect(round(reelPositions(3207, -3207, 60))).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('dialValues', () => {
  it('倒计时显示剩余，拨动方向与已学相反', () => {
    expect(dialValues('countDown', 7500, 3180, 60)).toEqual({
      base: 4320,
      offset: -60,
      over: false,
    });
  });

  it('超过目标后显示额外学习', () => {
    expect(dialValues('countDown', 7500, 7600, 0)).toEqual({ base: 100, offset: 0, over: true });
  });

  it('正计时和没有目标时显示已学', () => {
    expect(dialValues('countUp', 7500, 3180, 60)).toEqual({ base: 3180, offset: 60, over: false });
    expect(dialValues('countDown', 0, 3180, 0)).toEqual({ base: 3180, offset: 0, over: false });
  });
});

describe('badgeDigits', () => {
  it('不到一小时只显示分和秒', () => {
    const { digits, visible } = badgeDigits(-195);
    expect([digits.m1, digits.s10, digits.s1]).toEqual([3, 1, 5]);
    expect([visible.h1, visible.c1, visible.m10]).toEqual([false, false, false]);
  });

  it('有小时时显示完整的时:分:秒', () => {
    const { digits, visible } = badgeDigits(4 * 3600 + 7 * 60 + 9);
    expect([digits.h1, digits.m10, digits.m1, digits.s10, digits.s1]).toEqual([4, 0, 7, 0, 9]);
    expect([visible.h10, visible.h1, visible.m10]).toEqual([false, true, true]);
  });
});
