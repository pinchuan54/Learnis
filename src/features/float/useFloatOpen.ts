import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import { inTauri } from '../../lib/platform';

/** 悬浮窗开着没有（后端开关悬浮窗时发 float-open 事件；启动时悬浮窗总是关着的） */
export function useFloatOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!inTauri) return;
    const unlisten = listen<boolean>('float-open', ({ payload }) => setOpen(payload));
    return () => void unlisten.then((stop) => stop());
  }, []);
  return open;
}
