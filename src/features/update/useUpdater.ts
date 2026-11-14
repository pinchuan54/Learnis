import { listen } from '@tauri-apps/api/event';
import { useCallback, useState } from 'react';
import { api } from '../../api/client';
import type { UpdateInfo, UpdateProgress } from '../../api/types';

/** 与 Rust 端 desktop::updater::UPDATE_PROGRESS_EVENT 一致 */
const UPDATE_PROGRESS_EVENT = 'update-progress';

export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'latest' }
  | { phase: 'available'; info: UpdateInfo }
  | { phase: 'installing'; info: UpdateInfo; progress: UpdateProgress | null };

/**
 * 检查更新与一键更新的界面状态。只在用户点击时联网。
 *
 * 出错时回到出错前可以重试的状态，并交给 `onError` 提示。
 */
export function useUpdater(onError: (error: unknown) => void) {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' });

  /** 检查新版本，返回新版本信息；已是最新或出错时返回 null */
  const check = useCallback(async (): Promise<UpdateInfo | null> => {
    setState({ phase: 'checking' });
    try {
      const info = await api.checkUpdate();
      setState(info ? { phase: 'available', info } : { phase: 'latest' });
      return info;
    } catch (error) {
      setState({ phase: 'idle' });
      onError(error);
      return null;
    }
  }, [onError]);

  /** 下载并安装；成功时应用会关闭并自动重新打开 */
  const install = useCallback(
    async (info: UpdateInfo) => {
      setState({ phase: 'installing', info, progress: null });
      let unlisten: (() => void) | undefined;
      try {
        unlisten = await listen<UpdateProgress>(UPDATE_PROGRESS_EVENT, (event) => {
          setState({ phase: 'installing', info, progress: event.payload });
        });
        await api.installUpdate();
      } catch (error) {
        setState({ phase: 'available', info });
        onError(error);
      } finally {
        unlisten?.();
      }
    },
    [onError],
  );

  return { state, check, install };
}
