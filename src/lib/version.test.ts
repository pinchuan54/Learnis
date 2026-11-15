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

  it('内部测试包的构建号显示为 dev 编号', () => {
    expect(formatDisplayVersion('0.1.2+3')).toBe('v0.1.2-dev.3');
    expect(formatDisplayVersion('0.2.0+1')).toBe('v0.2-dev.1');
    expect(formatDisplayVersion('0.1.2+12')).toBe('v0.1.2-dev.12');
  });

  it('非标准格式原样返回', () => {
    expect(formatDisplayVersion('0.1.0-beta.1')).toBe('0.1.0-beta.1');
    expect(formatDisplayVersion('0.1.2+build.3')).toBe('0.1.2+build.3');
  });
});
