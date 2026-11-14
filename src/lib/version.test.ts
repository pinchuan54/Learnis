import { describe, expect, it } from 'vitest';
import { formatDisplayVersion } from './version';

describe('formatDisplayVersion', () => {
  it('补丁号为 0 时省略', () => {
    expect(formatDisplayVersion('0.1.0')).toBe('v0.1');
    expect(formatDisplayVersion('1.0.0')).toBe('v1.0');
  });

  it('补丁号不为 0 时保留', () => {
    expect(formatDisplayVersion('0.1.1')).toBe('v0.1.1');
    expect(formatDisplayVersion('0.1.12')).toBe('v0.1.12');
  });

  it('非标准格式原样返回', () => {
    expect(formatDisplayVersion('0.1.0-beta.1')).toBe('0.1.0-beta.1');
  });
});
