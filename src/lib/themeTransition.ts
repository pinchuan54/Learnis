import type { ResolvedTheme } from './theme';

/** 屏幕上的一个点（视口坐标，单位 px） */
export interface Point {
  x: number;
  y: number;
}

/**
 * 外观切换用哪种过渡：
 * - `instant`：直接切换（外观没变、或系统设置了减少动态效果）
 * - `fade`：整体颜色渐变（系统自己切换深浅色、或不支持视图过渡）
 * - `reveal`：新外观从点击处以圆形展开，盖过旧外观
 */
export type ThemeTransitionKind = 'instant' | 'fade' | 'reveal';

export interface ThemeTransitionInput {
  /** 切换前实际生效的外观 */
  from: ResolvedTheme;
  /** 切换后实际生效的外观 */
  to: ResolvedTheme;
  /** 系统设置了减少动态效果 */
  reducedMotion: boolean;
  /** 支持 document.startViewTransition */
  supportsViewTransition: boolean;
  /** 有圆形展开的圆心（用户点了外观卡片）；系统自己切换深浅色时没有 */
  hasOrigin: boolean;
}

/** 根据切换前后的外观和运行环境，决定用哪种过渡 */
export function chooseThemeTransition(input: ThemeTransitionInput): ThemeTransitionKind {
  if (input.from === input.to || input.reducedMotion) {
    return 'instant';
  }
  if (!input.hasOrigin || !input.supportsViewTransition) {
    return 'fade';
  }
  return 'reveal';
}

/** 元素矩形的中心点，作为圆形展开的圆心 */
export function rectCenter(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** 圆形展开最终要盖住整个视口：取圆心到视口四个角的最远距离，向上取整 */
export function revealRadius(origin: Point, viewportWidth: number, viewportHeight: number): number {
  const dx = Math.max(origin.x, viewportWidth - origin.x);
  const dy = Math.max(origin.y, viewportHeight - origin.y);
  return Math.ceil(Math.hypot(dx, dy));
}

/** 圆形展开的 clip-path 起止关键帧：从圆心的一个点扩大到半径 radius */
export function revealClipPath(origin: Point, radius: number): [string, string] {
  const at = `at ${origin.x}px ${origin.y}px`;
  return [`circle(0px ${at})`, `circle(${radius}px ${at})`];
}
