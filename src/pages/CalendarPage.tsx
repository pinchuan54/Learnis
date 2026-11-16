import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useClock, useMonth, usePlans, useSettings } from '../api/hooks';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../components/icons';
import { Button } from '../components/ui/Button';
import { ProgressRing } from '../components/ui/ProgressRing';
import { PendingPanel } from '../features/adjust/PendingPanel';
import { MonthGrid } from '../features/calendar/MonthGrid';
import { LEGEND } from '../features/calendar/statusColors';
import { PlanSheet } from '../features/plans/PlanSheet';
import { formatMonthTitle, parseDateKey, shiftMonth } from '../lib/dates';
import { formatHours } from '../lib/format';
import page from '../styles/page.module.css';
import styles from './CalendarPage.module.css';

/** 月历：主界面 */
export function CalendarPage() {
  const navigate = useNavigate();
  const { data: clock } = useClock();
  const { data: plans } = usePlans();
  const { data: settings } = useSettings();
  const [view, setView] = useState<{ year: number; month: number } | null>(null);
  const [creating, setCreating] = useState(false);

  const today = clock ? parseDateKey(clock.today) : null;
  const current = view ?? (today ? { year: today.year, month: today.month } : null);
  const { data: overview } = useMonth(current?.year ?? 0, current?.month ?? 0, current !== null);

  const totals = overview?.days.reduce(
    (sum, cell) => ({
      target: sum.target + cell.targetMinutes,
      studied: sum.studied + cell.studiedSeconds,
    }),
    { target: 0, studied: 0 },
  );
  const noPlans = plans !== undefined && plans.length === 0;
  const isCurrentMonth =
    today && current && today.year === current.year && today.month === current.month;

  return (
    <div className={page.page}>
      <header className={`${page.header} ${page.headerWithActions}`}>
        <div className={page.headerText}>
          <p className={page.eyebrow}>月历</p>
          <h1 className={page.title}>
            {current ? formatMonthTitle(current.year, current.month) : ' '}
          </h1>
          {totals && totals.target + totals.studied > 0 && (
            <p className={page.subtitle}>
              本月已学 {formatHours(totals.studied / 60)} 小时，目标 {formatHours(totals.target)}{' '}
              小时
            </p>
          )}
        </div>
        {current && (
          <div className={page.headerActions}>
            <Button
              iconOnly
              aria-label="上个月"
              onClick={() => setView(shiftMonth(current.year, current.month, -1))}
            >
              <ChevronLeftIcon />
            </Button>
            <Button disabled={Boolean(isCurrentMonth)} onClick={() => setView(null)}>
              本月
            </Button>
            <Button
              iconOnly
              aria-label="下个月"
              onClick={() => setView(shiftMonth(current.year, current.month, 1))}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        )}
      </header>

      {noPlans ? (
        <section className={styles.hero} aria-labelledby="calendar-empty-title">
          <ProgressRing progress={0.68} size={112} stroke={13} className={styles.ring} />
          <h2 id="calendar-empty-title" className={styles.heroTitle}>
            还没有学习计划
          </h2>
          <p className={styles.heroText}>
            设定一个总时长和期限，Learnis 会把它分配到每一天，
            <br />
            你只需要按下计时器。
          </p>
          <Button
            variant="primary"
            size="lg"
            className={styles.heroButton}
            onClick={() => setCreating(true)}
          >
            <PlusIcon />
            新建计划
          </Button>
        </section>
      ) : (
        <>
          <PendingPanel compact />
          {overview && (
            <MonthGrid overview={overview} onSelect={(date) => navigate(`/day/${date}`)} />
          )}
          {settings?.showCalendarLegend && (
            <ul className={styles.legend} aria-label="图例">
              {LEGEND.map((item) => (
                <li key={item.label}>
                  <span className={styles.legendDot} style={{ background: item.color }} />
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <PlanSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
