import {
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
import {
  DEFAULT_PLACEMENT,
  type Placement,
  type Rect,
  settle,
  windowPosition,
  windowSize,
} from './geometry';

/** 位置是频繁变化的界面状态，存在悬浮窗自己的本地存储里 */
const STORAGE_KEY = 'learnis.float.placement';
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

/** 窗口平滑滑到目标位置（松手贴边时） */
function glide(from: { x: number; y: number }, to: { x: number; y: number }) {
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - start) / 220, 1);
    const k = 1 - (1 - t) ** 3;
    void appWindow.setPosition(
      new PhysicalPosition(
        Math.round(from.x + (to.x - from.x) * k),
        Math.round(from.y + (to.y - from.y) * k),
      ),
    );
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

interface Options {
  /** 悬停展开按钮时多出的宽度（已乘大小比例） */
  growth: number;
  locked: boolean;
  /** 展开中：尺寸会变，先不重新量 */
  frozen: boolean;
  /** 第一次摆好位置、显示出来之后调用 */
  onShown: () => void;
}

/**
 * 悬浮窗窗口的大小和位置：按内容大小设窗口尺寸、按贴边方向摆好，第一次摆好后才显示；
 * 按住拖动时自己挪窗口（不走系统拖动，不会把窗口激活），松手靠近边缘就贴过去，位置记下来。
 */
export function usePlacement(content: RefObject<HTMLElement | null>, options: Options) {
  const [placement, setPlacement] = useState(loadPlacement);
  const [dragging, setDragging] = useState(false);
  const rect = useRef<Rect | null>(null);
  const shown = useRef(false);
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; moved: boolean } | null>(
    null,
  );

  // 内容大小变了（换形态、调大小、位数变化）就重新设窗口尺寸、重新摆
  const { growth, frozen } = options;
  useEffect(() => {
    const el = content.current;
    if (!el) return;
    const layout = async () => {
      if (drag.current?.moved || frozen) return;
      const dpr = window.devicePixelRatio;
      const size = windowSize(el.getBoundingClientRect(), growth, dpr);
      const area = await areaFor(placement);
      if (!area) return;
      const pos = windowPosition(placement, size, area, dpr);
      await appWindow.setSize(new PhysicalSize(size.width, size.height));
      await appWindow.setPosition(new PhysicalPosition(pos.x, pos.y));
      rect.current = { ...pos, ...size };
      if (!shown.current) {
        shown.current = true;
        await appWindow.show();
        latest.current.onShown();
      }
    };
    const observer = new ResizeObserver(() => void layout());
    observer.observe(el);
    void layout();
    return () => observer.disconnect();
  }, [content, placement, growth, frozen]);

  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dpr = window.devicePixelRatio;
      const dx = (event.screenX - d.sx) * dpr;
      const dy = (event.screenY - d.sy) * dpr;
      if (!d.moved) {
        // 动了 4px 以上才算拖动
        if (Math.hypot(dx, dy) < 4 * dpr) return;
        d.moved = true;
        setDragging(true);
      }
      const next = { x: Math.round(d.x + dx), y: Math.round(d.y + dy) };
      if (rect.current) rect.current = { ...rect.current, ...next };
      void appWindow.setPosition(new PhysicalPosition(next.x, next.y));
    };
    const up = async () => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved || !rect.current) return;
      setDragging(false);
      const current = rect.current;
      const center = { cx: current.x + current.width / 2, cy: current.y + current.height / 2 };
      const area = await areaFor({ ax: null, ay: null, ...center });
      if (!area) return;
      const next = settle(current, area, window.devicePixelRatio);
      const target = windowPosition(next, current, area, window.devicePixelRatio);
      glide(current, target);
      rect.current = { ...current, ...target };
      setPlacement(next);
      savePlacement(next);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  /** 在悬浮窗上按下：按钮、拖角以外的地方按住拖动 */
  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    const target = event.target as Element;
    if (
      event.button !== 0 ||
      latest.current.locked ||
      target.closest('.tg, .grip') ||
      !rect.current
    )
      return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 拿不到捕获也能拖，只是鼠标移出窗口时会断
    }
    drag.current = { sx: event.screenX, sy: event.screenY, ...rect.current, moved: false };
  }, []);

  return { placement, dragging, onPointerDown };
}
