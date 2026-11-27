import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { api } from '../../api/client';

/** 后端发来的穿透时鼠标位置（窗口里的物理像素） */
const CURSOR_EVENT = 'float-cursor';

/** 点落在悬浮窗的形状上（`.w`，含拖角那段弧） */
const onShape = (target: EventTarget | Element | null) =>
  target instanceof Element && target.closest('.w') !== null;

/**
 * 点击穿透（#64）：窗口比看得见的形状大一圈，鼠标在形状外面时打开穿透，点击直接落到下面的软件。
 * 形状用浏览器自己的命中判定：胶囊的圆角、小圆表的圆（进度环不接收鼠标）、拖角的裁剪都算在内，和悬停判定一致。
 *
 * - 鼠标移到形状外面，或离开窗口：打开穿透；按着键时（拖动、拖角缩放）不动，不然一出形状就断了；
 * - 穿透时页面收不到鼠标，后端把窗口里的鼠标位置发过来，回到形状上就关掉穿透。
 */
export function usePassthrough() {
  useEffect(() => {
    let on: boolean | null = null;
    const set = (next: boolean) => {
      if (on === next) return;
      on = next;
      void api.setFloatPassthrough(next);
    };
    const move = (event: PointerEvent) => {
      if (!event.buttons) set(!onShape(event.target));
    };
    const out = (event: PointerEvent) => {
      if (!event.buttons && !event.relatedTarget) set(true);
    };
    const unlisten = listen<[number, number]>(CURSOR_EVENT, ({ payload: [x, y] }) => {
      const dpr = window.devicePixelRatio;
      if (onShape(document.elementFromPoint(x / dpr, y / dpr))) set(false);
    });
    // 一开始不知道鼠标在哪，先穿透；鼠标正好在形状上的话，后端下一次发位置就会关掉
    set(true);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerout', out);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', out);
      void unlisten.then((stop) => stop());
    };
  }, []);
}
