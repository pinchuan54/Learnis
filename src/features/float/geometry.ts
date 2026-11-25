/**
 * 悬浮窗窗口的大小和摆放（纯计算，配单元测试）。坐标、尺寸都是物理像素，常量是逻辑像素，乘 dpr 换算。
 *
 * 窗口比悬浮窗本身大一圈（PAD），放投影、悬停放大和按钮展开；悬浮窗在窗口里按贴边方向对齐：
 * 贴右时右对齐，展开往左长、右边缘不动；没贴边时居中，展开两边各长一半。
 */
import type { FloatForm } from '../../api/types';

export type EdgeX = 'left' | 'right' | null;
export type EdgeY = 'top' | 'bottom' | null;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 窗口四周的边距（和 float.css 里 .float 的 padding 一致） */
export const PAD = { top: 16, side: 18, bottom: 22 };
/** 贴边时悬浮窗离屏幕可用区域边缘的距离 */
export const EDGE_GAP = 12;
/** 松手时离边缘多近就贴过去 */
export const SNAP = 32;
/** 悬停时整体放大的比例（和 float.css 的 .float.open .w 一致） */
export const LIFT = 1.04;
/** 悬停展开按钮时多出来的宽度（和 float.css 一致） */
export const GROWTH: Record<FloatForm, number> = { minimal: 7, flip: 27, dial: 0 };

/** 摆放：贴哪条边；没贴边的方向记窗口中心 */
export interface Placement {
  ax: EdgeX;
  ay: EdgeY;
  cx: number;
  cy: number;
}

/** 窗口大小：悬浮窗收起时的大小（已含大小比例）+ 展开余量 + 放大余量 + 边距 */
export function windowSize(
  content: { width: number; height: number },
  growth: number,
  dpr: number,
) {
  return {
    width: Math.ceil(((content.width + growth) * LIFT + PAD.side * 2) * dpr),
    height: Math.ceil((content.height * LIFT + PAD.top + PAD.bottom) * dpr),
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** 按摆放和窗口大小算出窗口左上角；没贴边时以中心为准，并保证悬浮窗本身留在屏幕里 */
export function windowPosition(
  placement: Placement,
  size: { width: number; height: number },
  area: Rect,
  dpr: number,
) {
  const side = (EDGE_GAP - PAD.side) * dpr;
  const x =
    placement.ax === 'left'
      ? area.x + side
      : placement.ax === 'right'
        ? area.x + area.width - size.width - side
        : clamp(
            placement.cx - size.width / 2,
            area.x - PAD.side * dpr,
            area.x + area.width - size.width + PAD.side * dpr,
          );
  const y =
    placement.ay === 'top'
      ? area.y + (EDGE_GAP - PAD.top) * dpr
      : placement.ay === 'bottom'
        ? area.y + area.height - size.height - (EDGE_GAP - PAD.bottom) * dpr
        : clamp(
            placement.cy - size.height / 2,
            area.y - PAD.top * dpr,
            area.y + area.height - size.height + PAD.bottom * dpr,
          );
  return { x: Math.round(x), y: Math.round(y) };
}

/** 拖完松手：悬浮窗离哪条边近就贴过去，没贴边的方向记下窗口中心 */
export function settle(window: Rect, area: Rect, dpr: number): Placement {
  const left = window.x + PAD.side * dpr - area.x;
  const right = area.x + area.width - (window.x + window.width - PAD.side * dpr);
  const top = window.y + PAD.top * dpr - area.y;
  const bottom = area.y + area.height - (window.y + window.height - PAD.bottom * dpr);
  const near = SNAP * dpr;
  return {
    ax: left < near ? 'left' : right < near ? 'right' : null,
    ay: top < near ? 'top' : bottom < near ? 'bottom' : null,
    cx: window.x + window.width / 2,
    cy: window.y + window.height / 2,
  };
}

/** 第一次打开时的位置：主屏右上角 */
export const DEFAULT_PLACEMENT: Placement = { ax: 'right', ay: 'top', cx: 0, cy: 0 };
