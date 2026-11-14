import { useEffect, useId, useRef, useState } from 'react';
import { formatShortDate, WEEKDAY_SHORT, weekdayIndex } from '../../lib/dates';
import { CalendarIcon } from '../icons';
import forms from './forms.module.css';
import styles from './DatePicker.module.css';
import { MiniCalendar } from './MiniCalendar';

interface DatePickerProps {
  value: string | null;
  onChange: (date: string) => void;
  today: string;
  min?: string;
  max?: string;
  isDisabled?: (date: string) => boolean;
  placeholder?: string;
  ariaLabel?: string;
}

/** 小日历的大致尺寸，用于决定向下还是向上弹出 */
const POPOVER_HEIGHT = 330;
const POPOVER_WIDTH = 288;
const GAP = 6;

/**
 * 日期选择：点击后弹出小日历。
 * 小日历用原生 popover 显示在最顶层，不会被面板的滚动区域截断；
 * 点击外部或按 Esc 自动关闭。
 */
export function DatePicker({
  value,
  onChange,
  today,
  min,
  max,
  isDisabled,
  placeholder = '选择日期',
  ariaLabel,
}: DatePickerProps) {
  const popoverId = `date-picker-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const handleBeforeToggle = (event: Event) => {
      if ((event as ToggleEvent).newState !== 'open' || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const below = rect.bottom + GAP;
      const top =
        below + POPOVER_HEIGHT > window.innerHeight
          ? Math.max(GAP, rect.top - GAP - POPOVER_HEIGHT)
          : below;
      const left = Math.max(GAP, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - GAP));
      setPosition({ top, left });
    };
    const handleToggle = (event: Event) => setOpen((event as ToggleEvent).newState === 'open');
    popover.addEventListener('beforetoggle', handleBeforeToggle);
    popover.addEventListener('toggle', handleToggle);
    return () => {
      popover.removeEventListener('beforetoggle', handleBeforeToggle);
      popover.removeEventListener('toggle', handleToggle);
    };
  }, []);

  return (
    <div className={styles.picker}>
      <button
        ref={triggerRef}
        type="button"
        className={`${forms.input} ${styles.trigger}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        popoverTarget={popoverId}
      >
        <span className={value ? undefined : styles.placeholder}>
          {value
            ? `${formatShortDate(value, today)} 周${WEEKDAY_SHORT[weekdayIndex(value)]}`
            : placeholder}
        </span>
        <CalendarIcon className={styles.icon} />
      </button>
      <div
        ref={popoverRef}
        id={popoverId}
        popover="auto"
        className={styles.popover}
        style={position}
      >
        {open && (
          <MiniCalendar
            value={value}
            today={today}
            min={min}
            max={max}
            isDisabled={isDisabled}
            onChange={(date) => {
              onChange(date);
              popoverRef.current?.hidePopover();
            }}
          />
        )}
      </div>
    </div>
  );
}
