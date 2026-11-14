/** 用户选择的外观模式 */
export type ThemePreference = 'light' | 'dark' | 'system';

/** 实际生效的外观 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * 外观选择在本地存储中的键名。
 * public/theme-init.js 在页面渲染前读取同一个键，修改时两处要保持一致。
 */
export const THEME_STORAGE_KEY = 'learnis.theme';

/** 把存储中读到的任意值转换成合法的外观模式，无法识别时跟随系统 */
export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

/** 根据用户选择和系统当前是否为深色，得出实际生效的外观 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}
