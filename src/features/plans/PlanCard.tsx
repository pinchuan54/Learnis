import type { PlanSummary } from '../../api/types';
import { PencilIcon } from '../../components/icons';
import { Button } from '../../components/ui/Button';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { formatShortDate } from '../../lib/dates';
import { formatHours, formatMinutes, formatPercent } from '../../lib/format';
import { planColorVar } from '../../lib/planColors';
import { describeWeekdays } from '../../lib/weekdays';
import styles from './PlanCard.module.css';

interface PlanCardProps {
  plan: PlanSummary;
  today?: string;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

export function PlanCard({ plan, today, onEdit, onToggleArchive, onDelete }: PlanCardProps) {
  const color = planColorVar(plan.color);
  const progress = plan.studiedSeconds / (plan.totalMinutes * 60);
  const daily = plan.studyDayCount > 0 ? plan.totalMinutes / plan.studyDayCount : 0;

  return (
    <article className={plan.archived ? `${styles.card} ${styles.archived}` : styles.card}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <span className={styles.colorBar} style={{ background: color }} />
          <h3 className={styles.name}>{plan.name}</h3>
          {plan.goal && <p className={styles.goal}>{plan.goal}</p>}
        </div>
        <ProgressRing
          progress={progress}
          size={72}
          stroke={8}
          color={color}
          label={`已完成 ${formatPercent(progress)}`}
        >
          <span className={styles.percent}>{formatPercent(progress)}</span>
        </ProgressRing>
      </div>

      <dl className={styles.stats}>
        <div>
          <dt>已学</dt>
          <dd>
            {formatHours(plan.studiedSeconds / 60)}
            <span className={styles.of}> / {formatHours(plan.totalMinutes)} 小时</span>
          </dd>
        </div>
        <div>
          <dt>期限</dt>
          <dd>
            {formatShortDate(plan.startDate, today)} – {formatShortDate(plan.endDate, today)}
          </dd>
        </div>
        <div>
          <dt>每天约</dt>
          <dd>{formatMinutes(daily)}</dd>
        </div>
        <div>
          <dt>学习日</dt>
          <dd>{describeWeekdays(plan.studyWeekdays)}</dd>
        </div>
      </dl>

      <div className={styles.actions}>
        {!plan.archived && (
          <Button size="sm" onClick={onEdit}>
            <PencilIcon />
            编辑
          </Button>
        )}
        <Button size="sm" variant="plain" onClick={onToggleArchive}>
          {plan.archived ? '恢复' : '归档'}
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          删除
        </Button>
      </div>
    </article>
  );
}
