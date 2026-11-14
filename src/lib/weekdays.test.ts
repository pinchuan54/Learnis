import { describe, expect, it } from 'vitest';
import { ALL_WEEKDAYS, describeWeekdays, hasWeekday, toggleWeekday, WORKDAYS } from './weekdays';

describe('学习日掩码', () => {
  it('判断与切换', () => {
    expect(hasWeekday(WORKDAYS, 4)).toBe(true);
    expect(hasWeekday(WORKDAYS, 5)).toBe(false);
    expect(toggleWeekday(WORKDAYS, 5)).toBe(0b011_1111);
    expect(toggleWeekday(ALL_WEEKDAYS, 0)).toBe(0b111_1110);
  });

  it('文字描述', () => {
    expect(describeWeekdays(ALL_WEEKDAYS)).toBe('每天');
    expect(describeWeekdays(WORKDAYS)).toBe('工作日');
    expect(describeWeekdays(0b001_0101)).toBe('周一、三、五');
  });
});
