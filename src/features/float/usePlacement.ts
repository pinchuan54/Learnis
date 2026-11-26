import {
  availableMonitors,
  getCurrentWindow,
  type Monitor,
  monitorFromPoint,
  PhysicalPosition,
  PhysicalSize,
  primaryMonitor,
} from '@tauri-apps/api/window';
import {
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import {
  areaAt,
  DEFAULT_PLACEMENT,
  keepInside,
  type Placement,
  type Rect,
  settle,
  windowPosition,
  windowSize,
} from './geometry';

/** 位置是频繁变化的界面状态，存在悬浮窗自己的本地存储里 */
const STORAGE_KEY = 'learnis.float.placement';
/** 悬停展开 / 收起的过渡是 0.34 秒，过渡中量到的是半截的大小，等它走完再量 */
const SETTLE_MS = 400;
const appWindow = getCurrentWindow();

function loadPlacement(): Placement {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Placement | null;
    if (saved && Number.isFinite(saved.cx) && Number.isFinite(saved.cy)) return saved;
  } catch {
    // 读不到就用默认位置
  }
  return DEFAULT_PLACEMENT;
}

function savePlacement(placement: Placement) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(placement));
  } catch {
    // 存不了就下次回到默认位置
  }
}

const areaOf = ({ workArea }: Monitor): Rect => ({
  x: workArea.position.x,
  y: workArea.position.y,
  width: workArea.size.width,
  height: workArea.size.height,
});

/** 摆放所在的屏幕：按记下的中心找，找不到（显示器拔了）就回到主屏 */
async function areaFor(placement: Placement): Promise<Rect | null> {
  const monitor =
    (placement.cx || placement.cy ? await monitorFromPoint(placement.cx, placement.cy) : null) ??
    (await primaryMonitor());
  return monitor ? areaOf(monitor) : null;
}

interface Options {
  /** 悬停展开按钮时多出的宽度（已乘大小比例） */
  growth: number;
  /** 大小（百分比）：变了先按比例算出新尺寸摆好，不等重新量 */
  scale: number;
  /** 悬停展开中：量到的宽度里含展开的部分 */
  open: boolean;
  locked: boolean;
  /** 第一次摆好位置、显示出来之后调用 */
  onShown: () => void;
}

interface Drag {
  /** 按下时鼠标的屏幕坐标（CSS 像素）和窗口位置 */
  sx: number;
  sy: number;
  x: number;
  y: number;
  /** 按下时鼠标在窗口里的位置（物理像素），用来找鼠标在哪块屏幕上 */
  grabX: number;
  grabY: number;
  el: HTMLElement;
  pointerId: number;
  moved: boolean;
}

/**
 * 悬浮窗窗口的大小和位置：按内容大小设窗口尺寸、按贴边方向摆好，第一次摆好后才显示。
 * 窗口留足了悬停展开的余量，悬停时窗口不动；只有内容真的变大变小（换形态、调大小、位数变化）才重新摆。
 * 按住拖动时自己挪窗口（不走系统拖动，不会把窗口激活），不出屏幕；松手靠近边缘就贴过去，位置记下来。
 */
export function usePlacement(content: RefObject<HTMLElement | null>, options: Options) {
  const [placement, setPlacement] = useState(loadPlacement);
  const [dragging, setDragging] = useState(false);
  /** 窗口现在的位置和大小 */
  const rect = useRef<Rect | null>(null);
  /** 收起时悬浮窗的大小（CSS 像素），以及量的时候的大小比例 */
  const measured = useRef<{ width: number; height: number; scale: number } | null>(null);
  const shown = useRef(false);
  const seq = useRef(0);
  const toggledAt = useRef(0);
  const drag = useRef<Drag | null>(null);
  const monitors = useRef<Rect[]>([]);
  const latest = useRef({ ...options, placement });
  useLayoutEffect(() => {
    latest.current = { ...options, placement };
  });
  useLayoutEffect(() => {
    toggledAt.current = performance.now();
  }, [options.open]);

  /** 按内容大小和摆放设窗口；尺寸、位置都没变就不碰窗口 */
  const layout = useCallback(async () => {
    const m = measured.current;
    if (!m || drag.current?.moved) return;
    const id = ++seq.current;
    const { growth, scale, placement: target } = latest.current;
    const dpr = window.devicePixelRatio;
    const k = scale / m.scale;
    const size = windowSize({ width: m.width * k, height: m.height * k }, growth, dpr);
    const area = await areaFor(target);
    if (!area || id !== seq.current || drag.current?.moved) return;
    const pos = windowPosition(target, size, area, dpr);
    const prev = rect.current;
    rect.current = { ...pos, ...size };
    const jobs: Promise<void>[] = [];
    if (prev?.width !== size.width || prev.height !== size.height) {
      jobs.push(appWindow.setSize(new PhysicalSize(size.width, size.height)));
    }
    if (prev?.x !== pos.x || prev.y !== pos.y) {
      jobs.push(appWindow.setPosition(new PhysicalPosition(pos.x, pos.y)));
    }
    if (shown.current) return;
    await Promise.all(jobs);
    shown.current = true;
    await appWindow.show();
    latest.current.onShown();
  }, []);

  // 量悬浮窗收起时的大小：刚展开 / 收起时等过渡走完再量，展开着就减掉展开的部分
  useEffect(() => {
    const el = content.current;
    if (!el) return;
    let timer = 0;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize[0];
      const measure = () => {
        const { open, growth, scale } = latest.current;
        const next = { width: box.inlineSize - (open ? growth : 0), height: box.blockSize, scale };
        const m = measured.current;
        const k = m ? scale / m.scale : 1;
        if (
          m &&
          Math.abs(m.width * k - next.width) < 0.5 &&
          Math.abs(m.height * k - next.height) < 0.5
        )
          return;
        measured.current = next;
        void layout();
      };
      window.clearTimeout(timer);
      const wait = toggledAt.current + SETTLE_MS - performance.now();
      if (wait > 0 && measured.current) timer = window.setTimeout(measure, wait);
      else measure();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [content, layout]);

  // 换了摆放、大小比例、展开余量：按比例算好尺寸重新摆（没变就不动窗口）
  const { growth, scale } = options;
  useEffect(() => {
    void layout();
  }, [layout, placement, growth, scale]);

  useEffect(() => {
    /** 悬浮窗在屏幕上的位置（物理像素），窗口位置取 at */
    const boxAt = (at: { x: number; y: number }) => {
      const b = content.current!.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      return {
        x: at.x + b.left * dpr,
        y: at.y + b.top * dpr,
        width: b.width * dpr,
        height: b.height * dpr,
      };
    };
    const move = (event: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d || !rect.current) return;
      const dpr = window.devicePixelRatio;
      const dx = (event.screenX - d.sx) * dpr;
      const dy = (event.screenY - d.sy) * dpr;
      if (!d.moved) {
        // 动了 4px 以上才算拖动；从这时起才捕获鼠标，单纯点一下按钮照常是点击
        if (Math.hypot(dx, dy) < 4 * dpr) return;
        d.moved = true;
        setDragging(true);
        try {
          d.el.setPointerCapture(d.pointerId);
        } catch {
          // 拿不到捕获也能拖，只是鼠标移出窗口时会断
        }
      }
      // 悬浮窗不出鼠标所在的那块屏幕
      const at = { x: d.x + dx, y: d.y + dy };
      const area = areaAt(monitors.current, at.x + d.grabX, at.y + d.grabY);
      if (area) {
        const box = boxAt(at);
        const inside = keepInside(box, area, dpr);
        at.x += inside.x - box.x;
        at.y += inside.y - box.y;
      }
      const next = { x: Math.round(at.x), y: Math.round(at.y) };
      rect.current = { ...rect.current, ...next };
      void appWindow.setPosition(new PhysicalPosition(next.x, next.y));
    };
    const finish = (current: Rect, area: Rect) => {
      const dpr = window.devicePixelRatio;
      const next = settle(boxAt(current), area, dpr);
      const pos = windowPosition(next, current, area, dpr);
      rect.current = { ...current, ...pos };
      if (pos.x !== current.x || pos.y !== current.y) {
        void appWindow.setPosition(new PhysicalPosition(pos.x, pos.y));
      }
      // 贴边方向和窗口位置一起换（没贴边时中心就是松手时悬浮窗的中心），悬浮窗在屏幕上不跳
      flushSync(() => {
        setPlacement(next);
        setDragging(false);
      });
      savePlacement(next);
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      const current = rect.current;
      if (!d?.moved || !current) return;
      // 从按钮上按下拖动的，松手后不算点击
      const swallow = (event: Event) => event.stopPropagation();
      window.addEventListener('click', swallow, true);
      window.setTimeout(() => window.removeEventListener('click', swallow, true));
      const box = boxAt(current);
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const area = areaAt(monitors.current, center.x, center.y);
      if (area) finish(current, area);
      else
        void areaFor({ ax: null, ay: null, cx: center.x, cy: center.y }).then((found) => {
          if (found) finish(current, found);
          else setDragging(false);
        });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [content]);

  /** 在悬浮窗上按下（按钮上也行，拖动了就不算点击）：按住拖动 */
  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || latest.current.locked || !rect.current) return;
    const dpr = window.devicePixelRatio;
    drag.current = {
      sx: event.screenX,
      sy: event.screenY,
      x: rect.current.x,
      y: rect.current.y,
      grabX: event.clientX * dpr,
      grabY: event.clientY * dpr,
      el: event.currentTarget,
      pointerId: event.pointerId,
      moved: false,
    };
    void availableMonitors().then((list) => {
      monitors.current = list.map(areaOf);
    });
  }, []);

  return { placement, dragging, onPointerDown };
}
