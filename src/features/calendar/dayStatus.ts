import type { DayCell } from '../../api/types';

export type DayStatus = 'rest' | 'future' | 'progress' | 'done' | 'missed';

/** 一天的状态：休息 / 未开始 / 进行中 / 达标 / 没学够 */
export function dayStatus(cell: DayCell | undefined, today: string): DayStatus {
  if (!cell || (cell.targetMinutes === 0 && cell.studiedSeconds === 0)) return 'rest';
  if (cell.targetMinutes > 0 && cell.studiedSeconds >= cell.targetMinutes * 60) return 'done';
  if (cell.date < today) return cell.pendingMinutes > 0 ? 'missed' : 'done';
  if (cell.date > today) return 'future';
  return 'progress';
}
