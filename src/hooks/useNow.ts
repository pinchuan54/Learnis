import { useEffect, useState } from 'react';

/**
 * 定时返回当前时间戳，用于计时器跳动。
 * `frame` 按屏幕刷新率更新（物理秒表指针平滑转动）；`enabled` 为 false 时停止更新。
 */
export function useNow(interval: number | 'frame' = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    if (interval === 'frame') {
      let id = requestAnimationFrame(function tick() {
        setNow(Date.now());
        id = requestAnimationFrame(tick);
      });
      return () => cancelAnimationFrame(id);
    }
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval, enabled]);

  return now;
}
