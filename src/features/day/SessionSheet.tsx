import { useState } from 'react';
import { useAddSession, useClock, useUpdateSession } from '../../api/hooks';
import type { PlanSummary, Session } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import forms from '../../components/ui/forms.module.css';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/toast/ToastContext';
import {
  addDays,
  dateKeyOf,
  formatDayLabel,
  formatTimeOfDay,
  zonedTimeToMs,
} from '../../lib/dates';
import { formatSeconds } from '../../lib/format';
import styles from './SessionSheet.module.css';

interface SessionSheetProps {
  open: boolean;
  onClose: () => void;
  /** 补录到哪一天 */
  date: string;
  plans: PlanSummary[];
  /** 传入则为修改 */
  session?: Session | null;
}

/** 补录 / 修改学习记录 */
export function SessionSheet({ open, onClose, date, plans, session }: SessionSheetProps) {
  const { data: clock } = useClock();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={session ? '修改学习记录' : '补录学习时间'}
      description={session ? undefined : '忘了开计时器？在这里补上这段学习时间。'}
      width={480}
    >
      {open && clock && (
        <SessionForm
          date={date}
          plans={plans}
          session={session}
          timeZone={clock.timezone}
          today={clock.today}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function SessionForm({
  date,
  plans,
  session,
  timeZone,
  today,
  onDone,
}: {
  date: string;
  plans: PlanSummary[];
  session?: Session | null;
  timeZone: string;
  today: string;
  onDone: () => void;
}) {
  const baseDate = session ? dateKeyOf(session.startAt, timeZone) : date;
  const [planId, setPlanId] = useState<number | null>(session?.planId ?? plans[0]?.id ?? null);
  const [start, setStart] = useState(
    session ? formatTimeOfDay(session.startAt, timeZone) : '09:00',
  );
  const [end, setEnd] = useState(
    session?.endAt ? formatTimeOfDay(session.endAt, timeZone) : '10:00',
  );
  const [note, setNote] = useState(session?.note ?? '');
  const addSession = useAddSession();
  const updateSession = useUpdateSession();
  const toast = useToast();

  // 结束时间不晚于开始时间时，视为跨过 0 点到了第二天
  const crossesMidnight = end <= start;
  const startAt = zonedTimeToMs(baseDate, start, timeZone);
  const endAt = zonedTimeToMs(crossesMidnight ? addDays(baseDate, 1) : baseDate, end, timeZone);
  const durationSeconds = (endAt - startAt) / 1000;
  const valid = planId !== null && durationSeconds > 0 && start !== '' && end !== '';
  const pending = addSession.isPending || updateSession.isPending;

  const submit = () => {
    if (!valid || planId === null) return;
    const input = { planId, startAt, endAt, note };
    const options = {
      onSuccess: () => {
        toast.show(session ? '记录已修改' : `已补录 ${formatSeconds(durationSeconds)}`, 'success');
        onDone();
      },
      onError: toast.error,
    };
    if (session) updateSession.mutate({ id: session.id, input }, options);
    else addSession.mutate(input, options);
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className={styles.date}>{formatDayLabel(baseDate, today)}</p>

      <Field label="计划">
        <select
          className={forms.select}
          value={planId ?? ''}
          onChange={(event) => setPlanId(Number(event.target.value))}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </Field>

      <div className={forms.row}>
        <Field label="开始时间">
          <input
            className={forms.input}
            type="time"
            value={start}
            required
            onChange={(event) => setStart(event.target.value)}
          />
        </Field>
        <Field label="结束时间" hint={crossesMidnight ? '早于开始时间，按第二天计算' : undefined}>
          <input
            className={forms.input}
            type="time"
            value={end}
            required
            onChange={(event) => setEnd(event.target.value)}
          />
        </Field>
      </div>

      <Field label="备注" hint="可选">
        <input
          className={forms.input}
          value={note}
          maxLength={200}
          placeholder="例如：跟着教程做了一个粒子特效"
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      <p className={styles.duration}>
        时长 <strong>{durationSeconds > 0 ? formatSeconds(durationSeconds) : '—'}</strong>
      </p>

      <div className={styles.actions}>
        <Button onClick={onDone}>取消</Button>
        <Button type="submit" variant="primary" disabled={!valid || pending}>
          {session ? '保存' : '补录'}
        </Button>
      </div>
    </form>
  );
}
