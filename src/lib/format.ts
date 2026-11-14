/** 秒 → `01:02:03`（始终显示小时位） */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':');
}

/** 分钟 → `3 小时 27 分钟` / `45 分钟` / `2 小时` */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分钟`;
}

/** 秒 → 同 formatMinutes（不足 1 分钟按 0 计） */
export function formatSeconds(totalSeconds: number): string {
  return formatMinutes(Math.floor(Math.max(0, totalSeconds) / 60));
}

/** 分钟 → 小时数，最多保留 1 位小数：`3.5` / `12` */
export function formatHours(totalMinutes: number): string {
  const hours = Math.round((Math.max(0, totalMinutes) / 60) * 10) / 10;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/** 0 ~ 1 的进度 → `68%` */
export function formatPercent(ratio: number): string {
  return `${Math.round(Math.max(0, ratio) * 100)}%`;
}
