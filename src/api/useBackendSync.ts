import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { inTauri } from '../lib/platform';
import { api } from './client';
import { useClock } from './hooks';

/** 与 Rust 端 desktop::TIMER_CHANGED_EVENT 一致 */
const TIMER_CHANGED_EVENT = 'timer-changed';

/**
 * 保持界面与后台一致：
 * - 托盘、快捷键、自动暂停改变了计时 → 刷新数据；
 * - 跨过日界线 → 按默认方式处理未达标时长，并刷新数据。
 */
export function useBackendSync() {
  const queryClient = useQueryClient();
  const { data: clock } = useClock();
  const lastToday = useRef<string | null>(null);

  useEffect(() => {
    if (!inTauri) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen(TIMER_CHANGED_EVENT, () => {
      void queryClient.invalidateQueries();
    })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!clock) return;
    if (lastToday.current && lastToday.current !== clock.today) {
      void api
        .resolvePendingAutomatically()
        .catch(() => 0)
        .finally(() => queryClient.invalidateQueries());
    }
    lastToday.current = clock.today;
  }, [clock, queryClient]);
}
