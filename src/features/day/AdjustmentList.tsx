import { useUndoAdjustment } from '../../api/hooks';
import type { Adjustment, PlanSummary } from '../../api/types';
import { UndoIcon } from '../../components/icons';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/toast/ToastContext';
import { formatShortDate } from '../../lib/dates';
import { formatMinutes } from '../../lib/format';
import blocks from '../../styles/blocks.module.css';

const MODE_LABEL = {
  spread: '均分',
  split: '拆分',
  nextDay: '顺延',
} as const;

/** 涉及某天的调整记录，可撤销 */
export function AdjustmentList({
  date,
  adjustments,
  plans,
}: {
  date: string;
  adjustments: Adjustment[];
  plans: PlanSummary[];
}) {
  const undo = useUndoAdjustment();
  const toast = useToast();
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  return (
    <ul className={blocks.list}>
      {adjustments.map((adjustment) => {
        const total = adjustment.items.reduce((sum, item) => sum + item.minutes, 0);
        const outgoing = adjustment.fromDate === date;
        const incoming = adjustment.items.find((item) => item.date === date);
        const targets = adjustment.items
          .map((item) => `${formatShortDate(item.date)} ${formatMinutes(item.minutes)}`)
          .join('、');
        return (
          <li key={adjustment.id} className={blocks.row}>
            <div className={blocks.rowMain}>
              <span className={blocks.rowTitle}>
                {outgoing
                  ? `调出 ${formatMinutes(total)}`
                  : `从 ${formatShortDate(adjustment.fromDate)} 调入 ${formatMinutes(incoming?.minutes ?? 0)}`}
              </span>
              <span className={blocks.rowMeta}>
                {planById.get(adjustment.planId)?.name ?? '计划'} · {MODE_LABEL[adjustment.mode]}
                {outgoing && ` → ${targets}`}
              </span>
            </div>
            {adjustment.auto && <span className={blocks.badge}>自动</span>}
            <Button
              size="sm"
              variant="plain"
              onClick={() =>
                undo.mutate(adjustment.id, {
                  onSuccess: () => toast.show('已撤销调整'),
                  onError: toast.error,
                })
              }
            >
              <UndoIcon />
              撤销
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
