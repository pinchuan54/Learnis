import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { inTauri } from '../lib/platform';

/**
 * 跨窗口的数据变化通知（主窗口 ⇄ 悬浮窗）：一个窗口改了数据，其他窗口收到后刷新。
 * 事件里带上发出窗口的标签，发出的窗口自己已经刷新过，收到时忽略。
 */
export const DATA_CHANGED_EVENT = 'data-changed';

const selfLabel = inTauri ? getCurrentWindow().label : '';

export function broadcastDataChanged() {
  if (inTauri) void emit(DATA_CHANGED_EVENT, selfLabel).catch(() => {});
}

export function isOwnDataChange(source: unknown) {
  return source === selfLabel;
}
