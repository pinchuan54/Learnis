import { describe, expect, it } from 'vitest';
import { parseThemePreference, resolveTheme } from './theme';

describe('parseThemePreference', () => {
  it('识别三种合法值', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('system')).toBe('system');
  });

  it('无法识别时默认跟随系统', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference('Dark')).toBe('system');
    expect(parseThemePreference(1)).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('手动选择时不受系统影响', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('跟随系统时取系统外观', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
