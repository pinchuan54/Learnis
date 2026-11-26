import { emit, listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import type { TimerDisplay } from '../../api/types';

/** 主窗口「今天」页计时器表的实时读数，发给悬浮窗（拖动调整中、刚开始 / 暂停时比后台的数据新） */
export interface LiveTimer {
  planId: number;
  /** 表上的今天已学（含拖动中的调整），整秒 */
  seconds: number;
  /** 这个读数对应的时刻 */
  at: number;
  /** 表上实际用的正计时 / 倒计时 */
  display: TimerDisplay;
}

/** 主窗口 → 悬浮窗：读数变了（每走一秒、拖动中、切换正 / 倒计时）；离开「今天」页时发 null */
export const LIVE_TIMER_EVENT = 'live-timer';
/** 悬浮窗 → 主窗口：刚打开，要一次当前的读数（主窗口收起时不再逐帧刷新） */
export const FLOAT_READY_EVENT = 'float-ready';

/** 悬浮窗收主窗口计时器表的读数 */
export function useLiveTimer() {
  const [live, setLive] = useState<LiveTimer | null>(null);
  useEffect(() => {
    const unlisten = listen<LiveTimer | null>(LIVE_TIMER_EVENT, ({ payload }) => setLive(payload));
    void unlisten.then(() => emit(FLOAT_READY_EVENT));
    return () => void unlisten.then((stop) => stop());
  }, []);
  return live;
}
