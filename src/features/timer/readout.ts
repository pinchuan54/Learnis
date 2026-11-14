import type { TimerDisplay } from '../../api/types';

export interface Readout {
  /** 实际采用的显示方式（没有目标时倒计时退回正计时） */
  mode: TimerDisplay;
  /** 表盘上显示的秒数 */
  seconds: number;
  label: string;
  /** 已超出今日目标 */
  overtime: boolean;
}

/**
 * 计算计时器显示的内容。
 * - 倒计时：显示「目标 - 已学」；归零后转为显示超出的时长（额外学习）
 * - 正计时：显示今天已学
 */
export function computeReadout(
  display: TimerDisplay,
  targetSeconds: number,
  studiedSeconds: number,
): Readout {
  const overtime = targetSeconds > 0 && studiedSeconds > targetSeconds;
  if (display === 'countDown' && targetSeconds > 0) {
    const remaining = targetSeconds - studiedSeconds;
    return remaining >= 0
      ? { mode: 'countDown', seconds: remaining, label: '剩余', overtime: false }
      : { mode: 'countDown', seconds: -remaining, label: '额外学习', overtime: true };
  }
  return {
    mode: 'countUp',
    seconds: studiedSeconds,
    label: targetSeconds > 0 ? '今天已学' : '今天已学（今天没有目标）',
    overtime,
  };
}
