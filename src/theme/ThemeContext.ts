import { createContext, useContext } from 'react';
import type { ResolvedTheme, ThemePreference } from '../lib/theme';

export interface ThemeContextValue {
  /** 用户选择的外观模式 */
  preference: ThemePreference;
  /** 当前实际生效的外观 */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme 必须在 ThemeProvider 内使用');
  }
  return context;
}
