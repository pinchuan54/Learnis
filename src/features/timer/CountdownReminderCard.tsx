import { useId, useState } from 'react';
import { useAnswerCountdownReminder, useCountdownReminder, useTimerStatus } from '../../api/hooks';
import { CheckIcon } from '../../components/icons';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/toast/ToastContext';
import { formatMinutes } from '../../lib/format';
import styles from './CountdownReminderCard.module.css';

/**
 * 倒计时归零提醒：今天的目标学完时，在右下角弹出卡片询问继续学习还是暂停。
 * 卡片不遮挡页面、不抢焦点，页面照常可以操作；等待选择期间计时一直继续，只有点「暂停计时」才会停。
 */
export function CountdownReminderCard() {
  const { data: reminder } = useCountdownReminder();
  const { data: status } = useTimerStatus();
  const answer = useAnswerCountdownReminder();
  const toast = useToast();
  const titleId = useId();
  const textId = useId();
  // 点了之后立刻收起，不等后台刷新
  const [answeredId, setAnsweredId] = useState<number | null>(null);

  // 提醒针对的计时已经结束（例如用快捷键暂停了）就不再显示
  if (
    reminder == null ||
    reminder.sessionId === answeredId ||
    status?.running?.id !== reminder.sessionId
  ) {
    return null;
  }

  const respond = (pause: boolean) => {
    if (answer.isPending) return;
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
    <section
      className={styles.card}
      role="alertdialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={textId}
    >
      <div className={styles.header}>
        <span className={styles.badge} aria-hidden="true">
          <CheckIcon />
        </span>
        <h2 id={titleId} className={styles.title}>
          今天的目标完成了
        </h2>
      </div>
      <p id={textId} className={styles.text}>
        「{reminder.planName}」今天的 {formatMinutes(reminder.targetMinutes)}
        已经学完。计时还在继续，之后的时间会记为额外学习。
      </p>
      <div className={styles.actions}>
        <Button size="sm" onClick={() => respond(true)}>
          暂停计时
        </Button>
        <Button size="sm" variant="primary" onClick={() => respond(false)}>
          继续学习
        </Button>
      </div>
    </section>
  );
}
