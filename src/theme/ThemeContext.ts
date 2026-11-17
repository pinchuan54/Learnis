import { createContext, useContext } from 'react';
import type { ResolvedTheme, ThemePreference } from '../lib/theme';
import type { Point } from '../lib/themeTransition';

export interface ThemeContextValue {
  /** 用户选择的外观模式 */
  preference: ThemePreference;
  /** 当前实际生效的外观 */
  resolved: ResolvedTheme;
  /**
   * 切换外观。传入 origin（视口坐标，通常是被点卡片的中心）时，新外观从这里以圆形展开；
   * 不传则用颜色渐变。实际外观没变、或系统设置了减少动态效果时直接切换。
   */
  setPreference: (preference: ThemePreference, origin?: Point) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme 必须在 ThemeProvider 内使用');
  }
  return context;
}
