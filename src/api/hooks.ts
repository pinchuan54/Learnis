import {
  type QueryKey,
  useMutation,
  type UseMutationOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { type ApiError, api } from './client';
import { broadcastDataChanged } from './dataChanged';
import type {
  AdjustRequest,
  PlanInput,
  SessionInput,
  Settings,
  TodoInput,
  TodoPatch,
} from './types';

/** 统一的查询键，便于失效刷新 */
export const queryKeys = {
  clock: ['clock'] as const,
  settings: ['settings'] as const,
  autostart: ['autostart'] as const,
  timezones: ['timezones'] as const,
  plans: (includeArchived: boolean) => ['plans', includeArchived] as const,
  month: (year: number, month: number) => ['month', year, month] as const,
  day: (date: string) => ['day', date] as const,
  timer: ['timer'] as const,
  countdownReminder: ['countdownReminder'] as const,
  pending: ['pending'] as const,
} satisfies Record<string, QueryKey | ((...args: never[]) => QueryKey)>;

// ---------- 查询 ----------

export const useClock = () =>
  useQuery({ queryKey: queryKeys.clock, queryFn: api.getClock, refetchInterval: 60_000 });

export const useSettings = () =>
  useQuery({ queryKey: queryKeys.settings, queryFn: api.getSettings });

/** 开机自启以系统里的实际登记为准，不存在设置里 */
export const useAutostart = () =>
  useQuery({ queryKey: queryKeys.autostart, queryFn: api.getAutostart });

export const useTimezones = () =>
  useQuery({ queryKey: queryKeys.timezones, queryFn: api.listTimezones, staleTime: Infinity });

export const usePlans = (includeArchived = false) =>
  useQuery({
    queryKey: queryKeys.plans(includeArchived),
    queryFn: () => api.listPlans(includeArchived),
  });

export const useMonth = (year: number, month: number, enabled = true) =>
  useQuery({
    queryKey: queryKeys.month(year, month),
    queryFn: () => api.getMonth(year, month),
    enabled,
    placeholderData: (previous) => previous,
  });

export const useDay = (date: string | null) =>
  useQuery({
    queryKey: queryKeys.day(date ?? ''),
    queryFn: () => api.getDay(date ?? ''),
    enabled: date !== null,
  });

export const useMovableMinutes = (planId: number, date: string) =>
  useQuery({
    queryKey: ['movable', planId, date],
    queryFn: () => api.getMovableMinutes(planId, date),
  });

export const useTimerStatus = () =>
  useQuery({ queryKey: queryKeys.timer, queryFn: api.getTimerStatus });

export const useCountdownReminder = () =>
  useQuery({ queryKey: queryKeys.countdownReminder, queryFn: api.getCountdownReminder });

export const usePending = () => useQuery({ queryKey: queryKeys.pending, queryFn: api.listPending });

// ---------- 修改 ----------

/**
 * 修改后整体刷新：数据都在本机，量很小，
 * 全部失效比逐个推算受影响的查询更简单可靠。同时通知其他窗口（悬浮窗 / 主窗口）刷新。
 */
function useDataMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, ApiError, TVariables>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    ...options,
    mutationFn,
    onSettled: async (...args) => {
      broadcastDataChanged();
      await queryClient.invalidateQueries();
      await options?.onSettled?.(...args);
    },
  });
}

export const useUpdateSettings = () =>
  useDataMutation((patch: Partial<Settings>) => api.updateSettings(patch));

export const useSetAutostart = () =>
  useDataMutation((enabled: boolean) => api.setAutostart(enabled));

export const useCreatePlan = () => useDataMutation((input: PlanInput) => api.createPlan(input));

export const useUpdatePlan = () =>
  useDataMutation(({ id, input }: { id: number; input: PlanInput }) => api.updatePlan(id, input));

export const useSetPlanArchived = () =>
  useDataMutation(({ id, archived }: { id: number; archived: boolean }) =>
    api.setPlanArchived(id, archived),
  );

export const useDeletePlan = () => useDataMutation((id: number) => api.deletePlan(id));

export const useStartTimer = () => useDataMutation((planId: number) => api.startTimer(planId));

export const useStopTimer = () => useDataMutation(() => api.stopTimer());

export const useAnswerCountdownReminder = () =>
  useDataMutation(({ sessionId, pause }: { sessionId: number; pause: boolean }) =>
    api.answerCountdownReminder(sessionId, pause),
  );

export const useAddSession = () => useDataMutation((input: SessionInput) => api.addSession(input));

export const useUpdateSession = () =>
  useDataMutation(({ id, input }: { id: number; input: SessionInput }) =>
    api.updateSession(id, input),
  );

export const useDeleteSession = () => useDataMutation((id: number) => api.deleteSession(id));

export const useClearCorrection = () =>
  useDataMutation(({ planId, date }: { planId: number; date: string }) =>
    api.clearCorrection(planId, date),
  );

export const useAdjustDay = () =>
  useDataMutation((request: AdjustRequest) => api.adjustDay(request));

export const useUndoAdjustment = () => useDataMutation((id: number) => api.undoAdjustment(id));

export const useCreateTodo = () => useDataMutation((input: TodoInput) => api.createTodo(input));

export const useUpdateTodo = () =>
  useDataMutation(({ id, patch }: { id: number; patch: TodoPatch }) => api.updateTodo(id, patch));

export const useDeleteTodo = () => useDataMutation((id: number) => api.deleteTodo(id));

export const useReorderTodos = () =>
  useDataMutation(({ date, ids }: { date: string; ids: number[] }) => api.reorderTodos(date, ids));
