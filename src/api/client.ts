import { invoke } from '@tauri-apps/api/core';
import type {
  AdjustRequest,
  Adjustment,
  AllocationPreview,
  Clock,
  DayDetail,
  MonthOverview,
  PendingShortfall,
  Plan,
  PlanInput,
  PlanSummary,
  Session,
  SessionInput,
  Settings,
  TimerStatus,
  Todo,
  TodoInput,
  TodoPatch,
  UpdateInfo,
} from './types';

export type ApiErrorCode = 'database' | 'invalid' | 'not_found' | 'conflict' | 'internal';

/** Rust 端返回的错误；message 已是可直接展示给用户的中文 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

const ERROR_CODES: readonly ApiErrorCode[] = [
  'database',
  'invalid',
  'not_found',
  'conflict',
  'internal',
];

/** 把 invoke 抛出的任意错误统一转换成 ApiError */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    const knownCode = ERROR_CODES.find((item) => item === code) ?? 'internal';
    return new ApiError(knownCode, String(message));
  }
  return new ApiError('internal', typeof error === 'string' ? error : '发生未知错误');
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw toApiError(error);
  }
}

/** 所有后端命令；参数名与 Rust 命令一致（camelCase） */
export const api = {
  // 时间与设置
  getClock: () => call<Clock>('get_clock'),
  getSettings: () => call<Settings>('get_settings'),
  updateSettings: (patch: Partial<Settings>) => call<Settings>('update_settings', { patch }),
  listTimezones: () => call<string[]>('list_timezones'),

  // 计划
  listPlans: (includeArchived = false) => call<PlanSummary[]>('list_plans', { includeArchived }),
  getPlan: (id: number) => call<Plan>('get_plan', { id }),
  previewPlan: (input: PlanInput) => call<AllocationPreview>('preview_plan', { input }),
  createPlan: (input: PlanInput) => call<Plan>('create_plan', { input }),
  updatePlan: (id: number, input: PlanInput) => call<Plan>('update_plan', { id, input }),
  setPlanArchived: (id: number, archived: boolean) =>
    call<Plan>('set_plan_archived', { id, archived }),
  deletePlan: (id: number) => call<void>('delete_plan', { id }),

  // 概览
  getMonth: (year: number, month: number) => call<MonthOverview>('get_month', { year, month }),
  getDay: (date: string) => call<DayDetail>('get_day', { date }),

  // 计时与学习记录
  getTimerStatus: () => call<TimerStatus>('get_timer_status'),
  startTimer: (planId: number) => call<TimerStatus>('start_timer', { planId }),
  stopTimer: () => call<TimerStatus>('stop_timer'),
  addSession: (input: SessionInput) => call<Session>('add_session', { input }),
  updateSession: (id: number, input: SessionInput) =>
    call<Session>('update_session', { id, input }),
  deleteSession: (id: number) => call<void>('delete_session', { id }),

  // 未达标与调整
  listPending: () => call<PendingShortfall[]>('list_pending'),
  getMovableMinutes: (planId: number, date: string) =>
    call<number>('get_movable_minutes', { planId, date }),
  adjustDay: (request: AdjustRequest) => call<Adjustment>('adjust_day', { request }),
  undoAdjustment: (id: number) => call<void>('undo_adjustment', { id }),
  resolvePendingAutomatically: () => call<number>('resolve_pending_automatically'),

  // 待办
  createTodo: (input: TodoInput) => call<Todo>('create_todo', { input }),
  updateTodo: (id: number, patch: TodoPatch) => call<Todo>('update_todo', { id, patch }),
  deleteTodo: (id: number) => call<void>('delete_todo', { id }),
  reorderTodos: (date: string, ids: number[]) => call<Todo[]>('reorder_todos', { date, ids }),

  // 关于与更新
  openProjectPage: () => call<void>('open_project_page'),
  checkUpdate: () => call<UpdateInfo | null>('check_update'),
  /** 下载并安装新版本，成功后应用会自动重启，通常不会返回 */
  installUpdate: () => call<void>('install_update'),
};
