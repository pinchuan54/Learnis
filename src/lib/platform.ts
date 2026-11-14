import { isTauri } from '@tauri-apps/api/core';

/** 当前是否运行在 Tauri 桌面窗口中（浏览器预览时为 false） */
export const inTauri = isTauri();
