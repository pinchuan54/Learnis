import { useState } from 'react';
import { useAnswerCountdownReminder, useCountdownReminder, useTimerStatus } from '../../api/hooks';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/toast/ToastContext';
import { formatMinutes } from '../../lib/format';

/**
 * 倒计时归零提醒：今天的目标学完时询问继续学习还是暂停。
 * 计时不会自动停下；关掉面板（Esc、点遮罩）等同继续学习。
 */
export function CountdownReminderSheet() {
  const { data: reminder } = useCountdownReminder();
  const { data: status } = useTimerStatus();
  const answer = useAnswerCountdownReminder();
  const toast = useToast();
  // 点了之后立刻收起，不等后台刷新
  const [answeredId, setAnsweredId] = useState<number | null>(null);

  // 提醒针对的计时已经结束（例如用快捷键暂停了）就不再显示
  const open =
    reminder != null &&
    reminder.sessionId !== answeredId &&
    status?.running?.id === reminder.sessionId;

  const respond = (pause: boolean) => {
    if (!reminder || answer.isPending) return;
    setAnsweredId(reminder.sessionId);
    answer.mutate(
      { sessionId: reminder.sessionId, pause },
      {
        onError: (error) => {
          setAnsweredId(null);
          toast.error(error);
        },
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={() => respond(false)}
      title="今天的目标完成了"
      description={
        reminder &&
        `「${reminder.planName}」今天的 ${formatMinutes(reminder.targetMinutes)}已经学完。计时还在继续，之后的时间会记为额外学习。`
      }
      width={440}
      footer={
        <>
          <Button onClick={() => respond(true)}>暂停计时</Button>
          <Button variant="primary" onClick={() => respond(false)}>
            继续学习
          </Button>
        </>
      }
    />
  );
}
