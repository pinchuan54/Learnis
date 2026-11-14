import { describe, expect, it } from 'vitest';
import type { DayCell } from '../../api/types';
import { dayStatus } from './dayStatus';

const cell = (patch: Partial<DayCell>): DayCell => ({
  date: '2026-11-13',
  targetMinutes: 60,
  studiedSeconds: 0,
  planCount: 1,
  adjusted: false,
  pendingMinutes: 0,
  ...patch,
});

describe('dayStatus', () => {
  const today = '2026-11-13';

  it('没有目标也没学习是休息', () => {
    expect(dayStatus(undefined, today)).toBe('rest');
    expect(dayStatus(cell({ targetMinutes: 0 }), today)).toBe('rest');
  });

  it('学够目标是达标', () => {
    expect(dayStatus(cell({ studiedSeconds: 3600 }), today)).toBe('done');
  });

  it('过去没学够且有挂起是没学够', () => {
    expect(dayStatus(cell({ date: '2026-11-12', pendingMinutes: 60 }), today)).toBe('missed');
  });

  it('今天进行中、以后未开始', () => {
    expect(dayStatus(cell({ studiedSeconds: 600 }), today)).toBe('progress');
    expect(dayStatus(cell({ date: '2026-11-20' }), today)).toBe('future');
  });
});
