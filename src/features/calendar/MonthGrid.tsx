import type { DayCell, DayStatus, MonthOverview } from '../../api/types';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { monthGrid, parseDateKey, WEEKDAY_SHORT } from '../../lib/dates';
import { formatHours, formatMinutes, formatSeconds } from '../../lib/format';
import styles from './MonthGrid.module.css';
import { STATUS_COLOR } from './statusColors';

function cellLabel(date: string, cell: DayCell | undefined, status: DayStatus): string {
  const { month, day } = parseDateKey(date);
  const base = `${month}月${day}日`;
  if (!cell || status === 'rest') return `${base}，没有学习安排`;
  return `${base}，目标 ${formatMinutes(cell.targetMinutes)}，已学 ${formatSeconds(cell.studiedSeconds)}`;
}

interface MonthGridProps {
  overview: MonthOverview;
  onSelect: (date: string) => void;
}

/** 月历：每天一个进度环 */
export function MonthGrid({ overview, onSelect }: MonthGridProps) {
  const cells = new Map(overview.days.map((cell) => [cell.date, cell]));
  const days = monthGrid(overview.year, overview.month);

  return (
    <div className={styles.grid} role="grid" aria-label="月历">
      {WEEKDAY_SHORT.map((label, index) => (
        <div
          key={label}
          className={index >= 5 ? `${styles.weekday} ${styles.weekend}` : styles.weekday}
        >
          {label}
        </div>
      ))}
      {days.map((date) => {
        const { month, day } = parseDateKey(date);
        const inMonth = month === overview.month;
        const cell = inMonth ? cells.get(date) : undefined;
        const status: DayStatus = cell?.status ?? 'rest';
        const isToday = date === overview.today;
        const progress =
          cell && cell.targetMinutes > 0 ? cell.studiedSeconds / (cell.targetMinutes * 60) : 0;

        if (!inMonth) {
          return (
            <div key={date} className={`${styles.cell} ${styles.outside}`} aria-hidden="true">
              <span className={styles.number}>{day}</span>
            </div>
          );
        }

        return (
          <button
            key={date}
            type="button"
            className={[styles.cell, styles[status], isToday ? styles.today : ''].join(' ')}
            aria-label={cellLabel(date, cell, status)}
            onClick={() => onSelect(date)}
          >
            <span className={styles.top}>
              <span className={styles.number}>{day}</span>
              {cell?.adjusted && <span className={styles.adjusted} title="时长有调整" />}
            </span>
            {status !== 'rest' && cell && (
              <>
                <ProgressRing
                  progress={
                    status === 'done' || status === 'overtime' ? Math.max(progress, 1) : progress
                  }
                  size={34}
                  stroke={4.5}
                  color={STATUS_COLOR[status]}
                  className={styles.ring}
                />
                <span className={styles.amount}>
                  {cell.targetMinutes > 0
                    ? `${formatHours(cell.studiedSeconds / 60)}/${formatHours(cell.targetMinutes)}h`
                    : `+${formatHours(cell.studiedSeconds / 60)}h`}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
