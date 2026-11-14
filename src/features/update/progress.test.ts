import { describe, expect, it } from 'vitest';
import { describeProgress, formatMegabytes } from './progress';

const MB = 1024 * 1024;

describe('formatMegabytes', () => {
  it('保留一位小数', () => {
    expect(formatMegabytes(0)).toBe('0.0 MB');
    expect(formatMegabytes(2.5 * MB)).toBe('2.5 MB');
    expect(formatMegabytes(12_345_678)).toBe('11.8 MB');
  });
});

describe('describeProgress', () => {
  it('还没收到进度时显示准备中', () => {
    expect(describeProgress(null)).toEqual({ ratio: null, text: '正在准备下载…' });
  });

  it('按已下载 / 总大小计算百分比，向下取整', () => {
    expect(describeProgress({ downloaded: 3 * MB, total: 8 * MB })).toEqual({
      ratio: 0.375,
      text: '正在下载 37%（3.0 MB / 8.0 MB）',
    });
  });

  it('不知道总大小时只显示已下载多少', () => {
    expect(describeProgress({ downloaded: 5 * MB, total: null })).toEqual({
      ratio: null,
      text: '正在下载，已下载 5.0 MB',
    });
    expect(describeProgress({ downloaded: 5 * MB, total: 0 }).ratio).toBeNull();
  });

  it('下载完成后提示正在安装', () => {
    expect(describeProgress({ downloaded: 8 * MB, total: 8 * MB })).toEqual({
      ratio: 1,
      text: '下载完成，正在安装，Learnis 会自动重新打开',
    });
  });
});
