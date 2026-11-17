import { Navigate, useNavigate, useParams } from 'react-router';
import { useClock, useDay, usePlans } from '../api/hooks';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { Button } from '../components/ui/Button';
import { PendingPanel } from '../features/adjust/PendingPanel';
import { AdjustmentList } from '../features/day/AdjustmentList';
import { PlanDayList } from '../features/day/PlanDayList';
import { SessionSection } from '../features/day/SessionSection';
import { TodoSection } from '../features/day/TodoSection';
import { TimerPanel } from '../features/timer/TimerPanel';
import { addDays, formatDayLabel, formatShortDate, relativeDayName } from '../lib/dates';
import { formatMinutes, formatSeconds } from '../lib/format';
import blocks from '../styles/blocks.module.css';
import page from '../styles/page.module.css';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 某一天：计时（仅今天）、学习安排、待办、学习记录、调整记录 */
export function DayPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { data: clock } = useClock();
  const { data: allPlans } = usePlans(true);

  const date = params.date ?? clock?.today ?? null;
  const { data: day, error } = useDay(date && DATE_PATTERN.test(date) ? date : null);

  if (params.date && !DATE_PATTERN.test(params.date)) return <Navigate to="/" replace />;
  if (!clock || !date) return <div className={page.page} />;

  const today = clock.today;
  const isToday = date === today;
  const plans = allPlans ?? [];
  const activePlans = plans.filter((plan) => !plan.archived);
  const relative = relativeDayName(date, today);
  const target = day?.plans.reduce((sum, entry) => sum + entry.targetMinutes, 0) ?? 0;
  const studied = day?.plans.reduce((sum, entry) => sum + entry.studiedSeconds, 0) ?? 0;
  const goTo = (key: string) => navigate(key === today ? '/today' : `/day/${key}`);

  return (
    <div className={page.page}>
      <header className={`${page.header} ${page.headerWithActions}`}>
        <div className={page.headerText}>
          <p className={page.eyebrow}>{formatDayLabel(date, today)}</p>
          <h1 className={page.title}>{relative ?? formatShortDate(date)}</h1>
          {day && (
            <p className={page.subtitle}>
              {target > 0
                ? `目标 ${formatMinutes(target)}，已学 ${formatSeconds(studied)}`
                : studied > 0
                  ? `已学 ${formatSeconds(studied)}`
                  : '这天没有学习安排'}
            </p>
          )}
        </div>
        <div className={page.headerActions}>
          <Button iconOnly aria-label="前一天" onClick={() => goTo(addDays(date, -1))}>
            <ChevronLeftIcon />
          </Button>
          <Button disabled={isToday} onClick={() => goTo(today)}>
            今天
          </Button>
          <Button iconOnly aria-label="后一天" onClick={() => goTo(addDays(date, 1))}>
            <ChevronRightIcon />
          </Button>
        </div>
      </header>

      {error && <p className={blocks.errorText}>{error.message}</p>}

      {day && (
        <>
          {isToday && activePlans.length > 0 && (
            <section className={blocks.section}>
              <TimerPanel entries={day.plans} />
            </section>
          )}

          {isToday && (
            <div className={blocks.section}>
              <PendingPanel compact />
            </div>
          )}

          <section className={blocks.section}>
            <div className={blocks.sectionHeader}>
              <h2 className={blocks.sectionTitle}>学习安排</h2>
            </div>
            <PlanDayList date={date} today={today} entries={day.plans} />
          </section>

          <section className={blocks.section}>
            <div className={blocks.sectionHeader}>
              <h2 className={blocks.sectionTitle}>待办</h2>
              <span className={blocks.sectionNote}>
                {day.todos.length > 0 &&
                  `完成 ${day.todos.filter((todo) => todo.done).length} / ${day.todos.length}`}
              </span>
            </div>
            <TodoSection date={date} todos={day.todos} plans={activePlans} />
          </section>

          <section className={blocks.section}>
            <div className={blocks.sectionHeader}>
              <h2 className={blocks.sectionTitle}>学习记录</h2>
            </div>
            <SessionSection
              date={date}
              sessions={day.sessions}
              corrections={day.corrections}
              plans={plans}
            />
          </section>

          {day.adjustments.length > 0 && (
            <section className={blocks.section}>
              <div className={blocks.sectionHeader}>
                <h2 className={blocks.sectionTitle}>调整记录</h2>
              </div>
              <AdjustmentList date={date} adjustments={day.adjustments} plans={plans} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
