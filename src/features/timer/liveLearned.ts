import { emitTo, listen } from '@tauri-apps/api/event';
import { useSyncExternalStore } from 'react';
import type { TimerDisplay } from '../../api/types';
import { inTauri } from '../../lib/platform';
import { FLOAT_READY_EVENT, LIVE_TIMER_EVENT, type LiveTimer } from '../float/liveTimer';

/** 计时器表上正在显示的今天已学（含拖动中的调整），顶部计时胶囊跟着它走 */
export interface LiveLearned {
  planId: number;
  seconds: number;
}

let current: LiveLearned | null = null;
/** 同时发给悬浮窗的读数（带正 / 倒计时和时刻），悬浮窗跟着主窗口实时变 */
let live: LiveTimer | null = null;
const listeners = new Set<() => void>();

const sendToFloat = () => {
  if (inTauri) void emitTo('float', LIVE_TIMER_EVENT, live).catch(() => {});
};
// 悬浮窗刚打开时要一次当前的读数
if (inTauri) void listen(FLOAT_READY_EVENT, sendToFloat);

/** 计时面板每帧调用，离开时传 null；换了计划、跨过整秒或切换正 / 倒计时才通知 */
export function publishLiveLearned(next: (LiveLearned & { display: TimerDisplay }) | null): void {
  const value = next && { planId: next.planId, seconds: Math.floor(next.seconds + 1e-6) };
  if (
    value?.planId === current?.planId &&
    value?.seconds === current?.seconds &&
    next?.display === live?.display
  )
    return;
  current = value;
  live = next && value && { ...value, display: next.display, at: Date.now() };
  for (const listener of listeners) listener();
  sendToFloat();
}

export function useLiveLearned(): LiveLearned | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
