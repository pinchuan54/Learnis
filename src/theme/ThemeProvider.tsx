import { getCurrentWindow } from '@tauri-apps/api/window';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { inTauri } from '../lib/platform';
import {
  type ThemePreference,
  THEME_STORAGE_KEY,
  parseThemePreference,
  resolveTheme,
} from '../lib/theme';
import { ThemeContext, type ThemeContextValue } from './ThemeContext';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// 外观是本机界面偏好，且需在页面渲染前读取（见 public/theme-init.js），
// 因此保存在 WebView 本地存储，而不是 SQLite 设置表
function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function storePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // 存储不可用时只在本次运行中生效
  }
}

/** 管理浅色 / 深色 / 跟随系统，并同步到页面和原生窗口 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  );
  const resolved = resolveTheme(preference, systemPrefersDark);

  // 跟随系统的深浅色变化
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  // 在绘制前切换页面外观
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  // 原生窗口主题：手动选择时固定，跟随系统时交还给系统
  useEffect(() => {
    if (!inTauri) {
      return;
    }
    getCurrentWindow()
      .setTheme(preference === 'system' ? null : preference)
      .catch(() => {});
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    storePreference(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
