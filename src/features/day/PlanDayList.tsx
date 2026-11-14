import { useState } from 'react';
import { Link } from 'react-router';
import type { DayPlanEntry } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { formatMinutes, formatSeconds } from '../../lib/format';
import { planColorVar } from '../../lib/planColors';
import blocks from '../../styles/blocks.module.css';
import { AdjustSheet, type AdjustTarget } from '../adjust/AdjustSheet';
import styles from './PlanDayList.module.css';

/** 某天各计划的目标、进度与调整入口 */
export function PlanDayList({
  date,
  today,
  entries,
}: {
  date: string;
  today: string;
  entries: DayPlanEntry[];
}) {
  const [target, setTarget] = useState<AdjustTarget | null>(null);

  if (entries.length === 0) {
    return (
      <div className={blocks.empty}>
        <p className={blocks.emptyTitle}>这天没有学习安排</p>
        <p>
          休息日，或者还没有覆盖这一天的计划。<Link to="/plans">去看看计划</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className={blocks.list}>
        {entries.map((entry) => {
          const targetSeconds = entry.targetMinutes * 60;
          const progress =
            targetSeconds > 0 ? Math.min(entry.studiedSeconds / targetSeconds, 1) : 0;
          const remaining = Math.ceil(Math.max(0, targetSeconds - entry.studiedSeconds) / 60);
          const done = targetSeconds > 0 && entry.studiedSeconds >= targetSeconds;
          const extra = targetSeconds > 0 ? entry.studiedSeconds - targetSeconds : 0;
          const canMoveAway = date >= today && remaining > 0;
          return (
            <li key={entry.planId} className={`${blocks.row} ${styles.row}`}>
              <span className={blocks.dot} style={{ background: planColorVar(entry.color) }} />
              <div className={blocks.rowMain}>
                <div className={styles.titleLine}>
                  <span className={blocks.rowTitle}>{entry.name}</span>
                  {done && <span className={`${blocks.badge} ${blocks.badgeDone}`}>达标</span>}
                  {entry.incomingMinutes > 0 && (
                    <span className={`${blocks.badge} ${blocks.badgeAdjusted}`}>
                      调入 {formatMinutes(entry.incomingMinutes)}
                    </span>
                  )}
                  {entry.outgoingMinutes > 0 && (
                    <span className={`${blocks.badge} ${blocks.badgeAdjusted}`}>
                      调出 {formatMinutes(entry.outgoingMinutes)}
                    </span>
                  )}
                  {!entry.isStudyDay && entry.targetMinutes === 0 && (
                    <span className={blocks.badge}>休息日</span>
                  )}
                </div>
                <div className={blocks.progressBar}>
                  <span
                    className={blocks.progressFill}
                    style={{ width: `${progress * 100}%`, background: planColorVar(entry.color) }}
                  />
                </div>
                <span className={blocks.rowMeta}>
                  已学 {formatSeconds(entry.studiedSeconds)}
                  {entry.targetMinutes > 0 && ` / 目标 ${formatMinutes(entry.targetMinutes)}`}
                  {extra > 0 && (
                    <span className={styles.extra}>，额外学习 {formatSeconds(extra)}</span>
                  )}
                </span>
              </div>
              <div className={blocks.rowActions}>
                {entry.pendingMinutes > 0 && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() =>
                      setTarget({
                        planId: entry.planId,
                        planName: entry.name,
                        fromDate: date,
                        maxMinutes: entry.pendingMinutes,
                      })
                    }
                  >
                    安排没学够的 {formatMinutes(entry.pendingMinutes)}
                  </Button>
                )}
                {canMoveAway && (
                  <Button
                    size="sm"
                    onClick={() =>
                      setTarget({
                        planId: entry.planId,
                        planName: entry.name,
                        fromDate: date,
                        maxMinutes: remaining,
                        skipToday: date === today,
                      })
                    }
                  >
                    {date === today ? '今天不方便' : '挪到别天'}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <AdjustSheet target={target} onClose={() => setTarget(null)} />
    </>
  );
}
