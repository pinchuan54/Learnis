import { useState } from 'react';
import {
  formatMonthTitle,
  monthGrid,
  parseDateKey,
  shiftMonth,
  WEEKDAY_SHORT,
} from '../../lib/dates';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import styles from './MiniCalendar.module.css';

interface MiniCalendarProps {
  value: string | null;
  onChange: (date: string) => void;
  today: string;
  /** 可选的最早日期（含） */
  min?: string;
  /** 可选的最晚日期（含） */
  max?: string;
  /** 额外禁用的日期 */
  isDisabled?: (date: string) => boolean;
}

/** 小日历：选择单个日期 */
export function MiniCalendar({ value, onChange, today, min, max, isDisabled }: MiniCalendarProps) {
  const initial = parseDateKey(value ?? today);
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const days = monthGrid(view.year, view.month);

  const disabled = (date: string) =>
    (min !== undefined && date < min) ||
    (max !== undefined && date > max) ||
    (isDisabled?.(date) ?? false);

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <span className={styles.title}>{formatMonthTitle(view.year, view.month)}</span>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navButton}
            aria-label="上个月"
            onClick={() => setView(shiftMonth(view.year, view.month, -1))}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className={styles.navButton}
            aria-label="下个月"
            onClick={() => setView(shiftMonth(view.year, view.month, 1))}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
      <div className={styles.grid} role="grid">
        {WEEKDAY_SHORT.map((label) => (
          <span key={label} className={styles.weekday}>
            {label}
          </span>
        ))}
        {days.map((date) => {
          const { month, day } = parseDateKey(date);
          const classes = [styles.day];
          if (month !== view.month) classes.push(styles.outside);
          if (date === today) classes.push(styles.today);
          if (date === value) classes.push(styles.selected);
          return (
            <button
              key={date}
              type="button"
              className={classes.join(' ')}
              disabled={disabled(date)}
              aria-pressed={date === value}
              aria-label={date}
              onClick={() => onChange(date)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
