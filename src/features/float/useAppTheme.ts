import { useEffect, useState } from 'react';
import {
  parseThemePreference,
  type ResolvedTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
} from '../../lib/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readTheme(): ResolvedTheme {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // 存储不可用时跟随系统
  }
  return resolveTheme(parseThemePreference(stored), window.matchMedia(DARK_QUERY).matches);
}

/** Learnis 当前的浅色 / 深色：主窗口改了外观（本地存储变化）或系统切换深浅色时跟着变 */
export function useAppTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const update = () => setTheme(readTheme());
    const query = window.matchMedia(DARK_QUERY);
    window.addEventListener('storage', update);
    query.addEventListener('change', update);
    return () => {
      window.removeEventListener('storage', update);
      query.removeEventListener('change', update);
    };
  }, []);
  return theme;
}
