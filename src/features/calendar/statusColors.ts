import type { DayStatus } from '../../api/types';

/** 月历进度环的颜色（状态由后端计算，这里只做映射） */
export const STATUS_COLOR: Record<DayStatus, string> = {
  rest: 'var(--color-fill)',
  future: 'var(--color-fill)',
  progress: 'var(--status-progress)',
  done: 'var(--status-done)',
  // 与计时器里超出目标的「额外学习」同色
  overtime: 'var(--status-overtime)',
  missed: 'var(--status-missed)',
};

/** 月历下方的图例 */
export const LEGEND = [
  { label: '达标', color: STATUS_COLOR.done },
  { label: '多学', color: STATUS_COLOR.overtime },
  { label: '进行中', color: STATUS_COLOR.progress },
  { label: '没学够', color: STATUS_COLOR.missed },
  { label: '有调整', color: 'var(--status-adjusted)' },
];
