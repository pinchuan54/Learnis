import { useState } from 'react';
import { useClock, usePending } from '../../api/hooks';
import { Button } from '../../components/ui/Button';
import { formatDayLabel } from '../../lib/dates';
import { formatMinutes } from '../../lib/format';
import blocks from '../../styles/blocks.module.css';
import { AdjustSheet, type AdjustTarget } from './AdjustSheet';
import styles from './PendingPanel.module.css';

/**
 * 挂起待处理的未达标时长：打开程序时提醒，逐条安排。
 * `compact` 时先显示一行横幅，点开再展开列表（用在「今天」页，不挤占计时器）。
 */
export function PendingPanel({ compact = false }: { compact?: boolean }) {
  const { data: items } = usePending();
  const { data: clock } = useClock();
  const [target, setTarget] = useState<AdjustTarget | null>(null);
  const [open, setOpen] = useState(!compact);
  const [expanded, setExpanded] = useState(false);

  if (!items || items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + item.minutes, 0);
  const days = new Set(items.map((item) => item.date)).size;
  const visible = expanded ? items : items.slice(0, 3);

  return (
    <section className={styles.panel} aria-label="待安排的时长">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>有 {days} 天没学够</h2>
          <p className={styles.subtitle}>
            共 {formatMinutes(total)} 待安排，可以均分、拆分或顺延到其他日子。
          </p>
        </div>
        {compact && (
          <Button
            size="sm"
            variant={open ? 'secondary' : 'primary'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? '收起' : '去安排'}
          </Button>
        )}
      </div>
      {open && (
        <>
          <ul className={blocks.list}>
            {visible.map((item) => (
              <li key={`${item.planId}-${item.date}`} className={blocks.row}>
                <div className={blocks.rowMain}>
                  <span className={blocks.rowTitle}>{item.planName}</span>
                  <span className={blocks.rowMeta}>{formatDayLabel(item.date, clock?.today)}</span>
                </div>
                <span className={`${blocks.badge} ${blocks.badgeMissed}`}>
                  差 {formatMinutes(item.minutes)}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    setTarget({
                      planId: item.planId,
                      planName: item.planName,
                      fromDate: item.date,
                      maxMinutes: item.minutes,
                    })
                  }
                >
                  安排
                </Button>
              </li>
            ))}
          </ul>
          {items.length > 3 && (
            <Button
              size="sm"
              variant="plain"
              className={styles.more}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? '收起' : `查看全部 ${items.length} 条`}
            </Button>
          )}
        </>
      )}
      <AdjustSheet target={target} onClose={() => setTarget(null)} />
    </section>
  );
}
