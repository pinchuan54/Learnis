import { useSyncExternalStore } from 'react';

/** 计时器表上正在显示的今天已学（含拖动中的调整），顶部计时胶囊跟着它走 */
export interface LiveLearned {
  planId: number;
  seconds: number;
}

let current: LiveLearned | null = null;
const listeners = new Set<() => void>();

/** 计时面板每帧调用，离开时传 null；换了计划或跨过整秒才通知 */
export function publishLiveLearned(next: LiveLearned | null): void {
  const value = next && { planId: next.planId, seconds: Math.floor(next.seconds + 1e-6) };
  if (value?.planId === current?.planId && value?.seconds === current?.seconds) return;
  current = value;
  for (const listener of listeners) listener();
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
