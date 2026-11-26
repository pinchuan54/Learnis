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
/** 贴边时悬浮窗离屏幕可用区域边缘的距离；拖动时也不会比这更靠边 */
export const EDGE_GAP = 12;
/** 松手时离边缘多近就贴过去 */
export const SNAP = 32;
/** 悬停时整体放大的比例（和 float.css 的 .float.open .w 一致） */
export const LIFT = 1.04;
/** 悬停展开按钮时多出来的宽度（和 float.css 一致） */
export const GROWTH: Record<FloatForm, number> = { minimal: 7, flip: 27, dial: 0 };

/** 摆放：贴哪条边；没贴边的方向记悬浮窗中心 */
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

/** 按摆放和窗口大小算出窗口左上角；没贴边时让悬浮窗中心落在记下的中心，并留在屏幕里 */
export function windowPosition(
  placement: Placement,
  size: { width: number; height: number },
  area: Rect,
  dpr: number,
) {
  const side = (EDGE_GAP - PAD.side) * dpr;
  // 上下边距不一样，悬浮窗中心在窗口中线往上一点
  const middle = (size.height + (PAD.top - PAD.bottom) * dpr) / 2;
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
            placement.cy - middle,
            area.y - PAD.top * dpr,
            area.y + area.height - size.height + PAD.bottom * dpr,
          );
  return { x: Math.round(x), y: Math.round(y) };
}

/** 拖完松手：悬浮窗（box 是它在屏幕上的位置）离哪条边近就贴过去，没贴边的方向记下它的中心 */
export function settle(box: Rect, area: Rect, dpr: number): Placement {
  const near = SNAP * dpr;
  const left = box.x - area.x;
  const right = area.x + area.width - (box.x + box.width);
  const top = box.y - area.y;
  const bottom = area.y + area.height - (box.y + box.height);
  return {
    ax: left < near ? 'left' : right < near ? 'right' : null,
    ay: top < near ? 'top' : bottom < near ? 'bottom' : null,
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
  };
}

/** 拖动时悬浮窗不出屏幕：返回挪进可用区域（离边缘至少 EDGE_GAP）后的左上角 */
export function keepInside(box: Rect, area: Rect, dpr: number) {
  const gap = EDGE_GAP * dpr;
  return {
    x: clamp(box.x, area.x + gap, area.x + area.width - box.width - gap),
    y: clamp(box.y, area.y + gap, area.y + area.height - box.height - gap),
  };
}

/** 点所在的屏幕区域；落在屏幕之间的缝里就取最近的那块 */
export function areaAt(areas: Rect[], x: number, y: number): Rect | null {
  const distance = (a: Rect) =>
    Math.hypot(x - clamp(x, a.x, a.x + a.width - 1), y - clamp(y, a.y, a.y + a.height - 1));
  return areas.reduce<Rect | null>(
    (best, a) => (!best || distance(a) < distance(best) ? a : best),
    null,
  );
}

/**
 * 拖角缩放：鼠标从按下处挪了 (dx, dy)，悬浮窗该放大几倍（box 是按下时悬浮窗的大小）。
 * 拖角在贴边方向的对面，贴着的边不动；没贴边时从中心放大，拖角只走大小变化的一半。
 * 按拖角离鼠标最近来算，斜着拖、只横着或只竖着拖都能放大缩小。
 */
export function resizeRatio(
  dx: number,
  dy: number,
  box: { width: number; height: number },
  placement: Placement,
) {
  const gx = ((placement.ax === 'right' ? -1 : 1) * box.width) / (placement.ax ? 1 : 2);
  const gy = ((placement.ay === 'bottom' ? -1 : 1) * box.height) / (placement.ay ? 1 : 2);
  return 1 + (dx * gx + dy * gy) / (gx * gx + gy * gy);
}

/** 第一次打开时的位置：主屏右上角 */
export const DEFAULT_PLACEMENT: Placement = { ax: 'right', ay: 'top', cx: 0, cy: 0 };
