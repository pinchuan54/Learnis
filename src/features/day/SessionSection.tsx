import { useState } from 'react';
import { useClock, useDeleteSession } from '../../api/hooks';
import type { PlanSummary, Session } from '../../api/types';
import { PencilIcon, TrashIcon } from '../../components/icons';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/toast/ToastContext';
import { useNow } from '../../hooks/useNow';
import { formatTimeOfDay } from '../../lib/dates';
import { formatSeconds } from '../../lib/format';
import { planColorVar } from '../../lib/planColors';
import blocks from '../../styles/blocks.module.css';
import { SessionSheet } from './SessionSheet';
import styles from './SessionSection.module.css';

/** 某天的学习记录：计时器产生的和补录的，可修改、删除 */
export function SessionSection({
  date,
  sessions,
  plans,
}: {
  date: string;
  sessions: Session[];
  plans: PlanSummary[];
}) {
  const { data: clock } = useClock();
  const deleteSession = useDeleteSession();
  const toast = useToast();
  const [editing, setEditing] = useState<Session | null>(null);
  const [adding, setAdding] = useState(false);
  const hasRunning = sessions.some((session) => session.endAt === null);
  const now = useNow(1000, hasRunning);
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const timeZone = clock?.timezone ?? 'UTC';

  return (
    <>
      {sessions.length === 0 ? (
        <div className={blocks.empty}>
          <p>这天还没有学习记录。</p>
        </div>
      ) : (
        <ul className={blocks.list}>
          {sessions.map((session) => {
            const plan = planById.get(session.planId);
            const end = session.endAt ?? now;
            return (
              <li key={session.id} className={blocks.row}>
                <span
                  className={blocks.dot}
                  style={{ background: planColorVar(plan?.color ?? 'gray') }}
                />
                <div className={blocks.rowMain}>
                  <span className={blocks.rowTitle}>
                    {formatTimeOfDay(session.startAt, timeZone)} –{' '}
                    {session.endAt === null ? '现在' : formatTimeOfDay(session.endAt, timeZone)}
                    <span className={styles.duration}>
                      {formatSeconds((end - session.startAt) / 1000)}
                    </span>
                  </span>
                  <span className={blocks.rowMeta}>
                    {plan?.name ?? '已删除的计划'}
                    {session.note && ` · ${session.note}`}
                  </span>
                </div>
                {session.endAt === null ? (
                  <span className={`${blocks.badge} ${blocks.badgeDone}`}>计时中</span>
                ) : (
                  session.source === 'manual' && <span className={blocks.badge}>补录</span>
                )}
                <div className={blocks.rowActions}>
                  {session.endAt !== null && (
                    <Button
                      iconOnly
                      size="sm"
                      variant="plain"
                      aria-label="修改"
                      onClick={() => setEditing(session)}
                    >
                      <PencilIcon />
                    </Button>
                  )}
                  <Button
                    iconOnly
                    size="sm"
                    variant="plain"
                    aria-label={session.endAt === null ? '取消本次计时' : '删除'}
                    onClick={() =>
                      deleteSession.mutate(session.id, {
                        onSuccess: () => toast.show('记录已删除'),
                        onError: toast.error,
                      })
                    }
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.footer}>
        <Button
          size="sm"
          variant="plain"
          disabled={plans.length === 0}
          onClick={() => setAdding(true)}
        >
          补录学习时间
        </Button>
      </div>

      <SessionSheet open={adding} onClose={() => setAdding(false)} date={date} plans={plans} />
      <SessionSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        date={date}
        plans={plans}
        session={editing}
      />
    </>
  );
}
