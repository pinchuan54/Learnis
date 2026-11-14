import { WEEKDAY_SHORT } from './dates';

/** 学习日掩码：bit0 = 周一 … bit6 = 周日 */
export const ALL_WEEKDAYS = 0b111_1111;
export const WORKDAYS = 0b001_1111;
export const WEEKENDS = 0b110_0000;

export function hasWeekday(mask: number, index: number): boolean {
  return (mask & (1 << index)) !== 0;
}

export function toggleWeekday(mask: number, index: number): number {
  return mask ^ (1 << index);
}

/** 学习日的文字描述：每天 / 工作日 / 周末 / 周一、三、五 */
export function describeWeekdays(mask: number): string {
  if (mask === ALL_WEEKDAYS) return '每天';
  if (mask === WORKDAYS) return '工作日';
  if (mask === WEEKENDS) return '周末';
  const days = WEEKDAY_SHORT.filter((_, index) => hasWeekday(mask, index));
  return days.length === 0 ? '未选择' : `周${days.join('、')}`;
}
