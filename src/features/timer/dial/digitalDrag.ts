import type { DialUnit, FeelPreset } from '../feel/preset';

/**
 * 电子计时器按住上下拖：这次鼠标移动换算成表上的数变化了多少秒（往上拖为正）。
 *
 * 按「一格数字的高度」换算：速度 1 时拖过一格的高度正好走一格，数字完全跟手；
 * 拖得很快时（超过 0.5 像素 / 毫秒）按快拖加速额外多走几格。
 *
 * - dy：这次移动的像素（往下为正，和 clientY 同向）
 * - dtMs：和上一次移动相隔的毫秒
 * - rowPx：一格数字的高度（像素）。注意是一格，不是整条数字带（7 格或 11 格）的高度
 */
export function digitalDragSeconds(
  dy: number,
  dtMs: number,
  rowPx: number,
  unit: DialUnit,
  preset: FeelPreset,
): number {
  const pxPerMs = Math.abs(dy) / Math.max(1, dtMs);
  const boost = 1 + preset.accel * Math.max(0, pxPerMs - 0.5);
  return (-dy / rowPx) * preset.speed[unit] * boost * unit;
}
