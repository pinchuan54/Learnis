import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { inTauri } from '../lib/platform';
import { api } from './client';
import { useClock } from './hooks';

/**
 * 后台发出、需要刷新数据的事件：
 * - 与 Rust 端 desktop::TIMER_CHANGED_EVENT 一致：托盘、快捷键、通知按钮改变了计时；
 * - 与 Rust 端 desktop::reminder::COUNTDOWN_REMINDER_EVENT 一致：倒计时归零提醒出现或被处理。
 */
const REFRESH_EVENTS = ['timer-changed', 'countdown-reminder'];

/**
 * 保持界面与后台一致：
 * - 后台改变了计时或提醒 → 刷新数据；
 * - 跨过日界线 → 按默认方式处理未达标时长，并刷新数据。
 */
export function useBackendSync() {
  const queryClient = useQueryClient();
  const { data: clock } = useClock();
  const lastToday = useRef<string | null>(null);

  useEffect(() => {
    if (!inTauri) return;
    let disposed = false;
    const unlisteners: (() => void)[] = [];
    for (const event of REFRESH_EVENTS) {
      listen(event, () => {
        void queryClient.invalidateQueries();
      })
        .then((fn) => {
          if (disposed) fn();
          else unlisteners.push(fn);
        })
        .catch(() => {});
    }
    return () => {
      disposed = true;
      for (const fn of unlisteners) fn();
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
