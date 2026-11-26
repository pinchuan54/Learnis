import { getCurrentWindow, type Theme } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';

const appWindow = getCurrentWindow();

/**
 * 系统现在是浅色还是深色（读出来之前是 null）。
 * 不用页面的 prefers-color-scheme：几个窗口的 WebView 共用一份外观偏好，主窗口手动选了浅色 / 深色后，
 * 悬浮窗页面读到的也是那个。悬浮窗自己没设主题，它原生窗口的主题就是系统的。
 */
export function useSystemTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    void appWindow.theme().then((value) => setTheme(value ?? 'light'));
    const unlisten = appWindow.onThemeChanged(({ payload }) => setTheme(payload));
    return () => void unlisten.then((stop) => stop());
  }, []);
  return theme;
}
