import { QueryClient } from '@tanstack/react-query';

/**
 * 数据都在本机，读取很快：
 * - 不自动重试（本地错误重试也不会好）；
 * - 窗口重新获得焦点时刷新，保证跨天、托盘操作后数据是新的。
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});
