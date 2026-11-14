import type { PlanColor } from '../api/types';

export const PLAN_COLORS: { value: PlanColor; label: string }[] = [
  { value: 'blue', label: '蓝色' },
  { value: 'purple', label: '紫色' },
  { value: 'pink', label: '粉色' },
  { value: 'red', label: '红色' },
  { value: 'orange', label: '橙色' },
  { value: 'yellow', label: '黄色' },
  { value: 'green', label: '绿色' },
  { value: 'teal', label: '青色' },
  { value: 'gray', label: '灰色' },
];

/** 计划颜色对应的 CSS 变量（见 styles/palette.css） */
export function planColorVar(color: PlanColor | string): string {
  return `var(--plan-${color})`;
}
