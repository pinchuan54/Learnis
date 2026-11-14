import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './client';

describe('toApiError', () => {
  it('识别 Rust 端返回的结构化错误', () => {
    const error = toApiError({ code: 'conflict', message: '已经有一个计时正在进行' });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('conflict');
    expect(error.message).toBe('已经有一个计时正在进行');
  });

  it('未知错误码归为 internal', () => {
    expect(toApiError({ code: 'weird', message: 'x' }).code).toBe('internal');
  });

  it('字符串和其他值也能转换', () => {
    expect(toApiError('命令不存在').message).toBe('命令不存在');
    expect(toApiError(undefined).message).toBe('发生未知错误');
  });

  it('已经是 ApiError 时原样返回', () => {
    const original = new ApiError('invalid', '请填写计划名称');
    expect(toApiError(original)).toBe(original);
  });
});
