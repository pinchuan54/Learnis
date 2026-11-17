import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { useToast } from '../../../components/ui/toast/ToastContext';
import { DialController, type DialServerState } from './controller';

/** 创建计时器拖动的控制器、启动每帧刷新，并在服务端数据变化时交给它 */
export function useDialController(state: DialServerState): DialController {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [controller] = useState(
    () =>
      new DialController({
        stopTimer: () => api.stopTimer(),
        addCorrection: (planId, seconds, resume) => api.addCorrection(planId, seconds, resume),
        refresh: () => queryClient.invalidateQueries(),
      }),
  );

  useEffect(() => {
    controller.setErrorHandler((error) => toast.error(error));
  }, [controller, toast]);

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  const { planId, targetSeconds, display, running, studiedSeconds, studiedAt, dayStartMs } = state;
  useEffect(() => {
    controller.setServer({
      planId,
      targetSeconds,
      display,
      running,
      studiedSeconds,
      studiedAt,
      dayStartMs,
    });
  }, [controller, planId, targetSeconds, display, running, studiedSeconds, studiedAt, dayStartMs]);

  return controller;
}
