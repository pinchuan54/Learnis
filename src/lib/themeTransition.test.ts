import { describe, expect, it } from 'vitest';
import {
  type ThemeTransitionInput,
  chooseThemeTransition,
  rectCenter,
  revealClipPath,
  revealRadius,
} from './themeTransition';

const base: ThemeTransitionInput = {
  from: 'light',
  to: 'dark',
  reducedMotion: false,
  supportsViewTransition: true,
  hasOrigin: true,
};

describe('chooseThemeTransition', () => {
  it('点了卡片且支持视图过渡时圆形展开', () => {
    expect(chooseThemeTransition(base)).toBe('reveal');
    expect(chooseThemeTransition({ ...base, from: 'dark', to: 'light' })).toBe('reveal');
  });

  it('实际外观没变时直接切换，不放动画', () => {
    expect(chooseThemeTransition({ ...base, from: 'dark', to: 'dark' })).toBe('instant');
    expect(chooseThemeTransition({ ...base, from: 'light', to: 'light', hasOrigin: false })).toBe(
      'instant',
    );
  });

  it('减少动态效果时直接切换', () => {
    expect(chooseThemeTransition({ ...base, reducedMotion: true })).toBe('instant');
    expect(chooseThemeTransition({ ...base, reducedMotion: true, hasOrigin: false })).toBe(
      'instant',
    );
    expect(
      chooseThemeTransition({ ...base, reducedMotion: true, supportsViewTransition: false }),
    ).toBe('instant');
  });

  it('不支持视图过渡时整体颜色渐变', () => {
    expect(chooseThemeTransition({ ...base, supportsViewTransition: false })).toBe('fade');
  });

  it('系统自己切换深浅色（没有圆心）时整体颜色渐变', () => {
    expect(chooseThemeTransition({ ...base, hasOrigin: false })).toBe('fade');
  });
});

describe('rectCenter', () => {
  it('取矩形中心', () => {
    expect(rectCenter({ left: 100, top: 40, width: 200, height: 160 })).toEqual({ x: 200, y: 120 });
    expect(rectCenter({ left: 0, top: 0, width: 5, height: 3 })).toEqual({ x: 2.5, y: 1.5 });
  });
});

describe('revealRadius', () => {
  it('圆心在视口中央时到四角距离相等', () => {
    expect(revealRadius({ x: 400, y: 300 }, 800, 600)).toBe(500);
  });

  it('取到最远那个角的距离', () => {
    // 圆心靠左上，最远的是右下角：(800 - 100, 600 - 100) → √(700² + 500²) ≈ 860.23
    expect(revealRadius({ x: 100, y: 100 }, 800, 600)).toBe(861);
    // 圆心靠右下，最远的是左上角
    expect(revealRadius({ x: 700, y: 500 }, 800, 600)).toBe(861);
    // 圆心在左边缘中点，最远的是右侧两个角
    expect(revealRadius({ x: 0, y: 300 }, 800, 600)).toBe(855);
  });

  it('向上取整，保证最后一帧盖满角落', () => {
    const radius = revealRadius({ x: 123.4, y: 56.7 }, 1000, 700);
    expect(Number.isInteger(radius)).toBe(true);
    expect(radius).toBeGreaterThanOrEqual(Math.hypot(1000 - 123.4, 700 - 56.7));
  });
});

describe('revealClipPath', () => {
  it('从圆心的一个点扩大到给定半径', () => {
    expect(revealClipPath({ x: 200, y: 120.5 }, 900)).toEqual([
      'circle(0px at 200px 120.5px)',
      'circle(900px at 200px 120.5px)',
    ]);
  });
});
