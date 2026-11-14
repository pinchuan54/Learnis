import { describe, expect, it } from 'vitest';
import { formatClock, formatHours, formatMinutes, formatPercent, formatSeconds } from './format';

describe('format', () => {
  it('formatClock', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(3725.9)).toBe('01:02:05');
    expect(formatClock(-5)).toBe('00:00:00');
    expect(formatClock(100 * 3600)).toBe('100:00:00');
  });

  it('formatMinutes', () => {
    expect(formatMinutes(45)).toBe('45 分钟');
    expect(formatMinutes(120)).toBe('2 小时');
    expect(formatMinutes(207)).toBe('3 小时 27 分钟');
    expect(formatMinutes(0)).toBe('0 分钟');
  });

  it('formatSeconds 向下取整到分钟', () => {
    expect(formatSeconds(59)).toBe('0 分钟');
    expect(formatSeconds(3661)).toBe('1 小时 1 分钟');
  });

  it('formatHours', () => {
    expect(formatHours(90)).toBe('1.5');
    expect(formatHours(120)).toBe('2');
    expect(formatHours(60_000)).toBe('1000');
  });

  it('formatPercent', () => {
    expect(formatPercent(0.684)).toBe('68%');
    expect(formatPercent(1.5)).toBe('150%');
  });
});
