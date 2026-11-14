import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateKeyOf,
  diffDays,
  formatDayLabel,
  formatTimeOfDay,
  monthGrid,
  relativeDayName,
  shiftMonth,
  weekdayIndex,
  zonedTimeToMs,
} from './dates';

describe('日期运算', () => {
  it('addDays 跨月跨年', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('diffDays', () => {
    expect(diffDays('2026-11-13', '2026-11-20')).toBe(7);
    expect(diffDays('2026-11-20', '2026-11-13')).toBe(-7);
  });

  it('weekdayIndex 周一为 0', () => {
    expect(weekdayIndex('2026-11-09')).toBe(0);
    expect(weekdayIndex('2026-11-15')).toBe(6);
  });

  it('monthGrid 从周一开始共 42 天', () => {
    const grid = monthGrid(2026, 11);
    expect(grid).toHaveLength(42);
    // 2026-11-01 是周日，所以网格从 10-26（周一）开始
    expect(grid[0]).toBe('2026-10-26');
    expect(grid[6]).toBe('2026-11-01');
  });

  it('shiftMonth', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('文字描述', () => {
    expect(formatDayLabel('2026-11-13', '2026-11-13')).toBe('11月13日 星期五');
    expect(formatDayLabel('2027-01-01', '2026-11-13')).toBe('2027年1月1日 星期五');
    expect(relativeDayName('2026-11-14', '2026-11-13')).toBe('明天');
    expect(relativeDayName('2026-11-20', '2026-11-13')).toBeNull();
  });
});

describe('带时区的时刻', () => {
  it('上海时间与 UTC 互转', () => {
    const ms = zonedTimeToMs('2026-11-14', '01:00', 'Asia/Shanghai');
    expect(ms).toBe(Date.UTC(2026, 10, 13, 17));
    expect(formatTimeOfDay(ms, 'Asia/Shanghai')).toBe('01:00');
    expect(dateKeyOf(ms, 'Asia/Shanghai')).toBe('2026-11-14');
    expect(dateKeyOf(ms, 'UTC')).toBe('2026-11-13');
  });

  it('夏令时前后偏移正确', () => {
    // 纽约 2026-03-08 凌晨 2 点进入夏令时
    expect(zonedTimeToMs('2026-03-08', '01:00', 'America/New_York')).toBe(Date.UTC(2026, 2, 8, 6));
    expect(zonedTimeToMs('2026-03-08', '04:00', 'America/New_York')).toBe(Date.UTC(2026, 2, 8, 8));
  });
});
