import { useState } from 'react';
import { useAdjustDay, useClock } from '../../api/hooks';
import type { AdjustMode } from '../../api/types';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { DurationInput } from '../../components/ui/DurationInput';
import { Field } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/toast/ToastContext';
import { formatShortDate } from '../../lib/dates';
import { formatMinutes } from '../../lib/format';
import styles from './AdjustSheet.module.css';

/** 要把哪个计划哪天的时长挪走 */
export interface AdjustTarget {
  planId: number;
  planName: string;
  fromDate: string;
  /** 最多能调出的分钟数 */
  maxMinutes: number;
  /** 是否在提前挪走今天（今天不方便学习） */
  skipToday?: boolean;
}

const MODE_OPTIONS: { value: AdjustMode; label: string }[] = [
  { value: 'spread', label: '均分到后续' },
  { value: 'split', label: '拆分到指定日' },
  { value: 'nextDay', label: '全加到下一天' },
];

const MODE_HINT: Record<AdjustMode, string> = {
  spread: '平均分到期限内剩下的每个学习日。',
  split: '拆成几段，分别放到你选的日子，例如 1 小时 + 3 小时 + 1 小时。',
  nextDay: '全部加到下一个学习日（精力足够的话）。',
};

interface SplitRow {
  key: number;
  date: string | null;
  minutes: number;
}

export function AdjustSheet({
  target,
  onClose,
}: {
  target: AdjustTarget | null;
  onClose: () => void;
}) {
  const { data: clock } = useClock();
  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={target?.skipToday ? '今天不方便学习' : '安排没学够的时长'}
      description={
        target &&
        `把「${target.planName}」在 ${formatShortDate(target.fromDate)} 的 ${formatMinutes(target.maxMinutes)} 挪到其他日子。`
      }
      width={560}
    >
      {target && clock && <AdjustForm target={target} today={clock.today} onDone={onClose} />}
    </Sheet>
  );
}

function AdjustForm({
  target,
  today,
  onDone,
}: {
  target: AdjustTarget;
  today: string;
  onDone: () => void;
}) {
  const [minutes, setMinutes] = useState(target.maxMinutes);
  const [mode, setMode] = useState<AdjustMode>('spread');
  const [rows, setRows] = useState<SplitRow[]>([
    { key: 1, date: null, minutes: target.maxMinutes },
  ]);
  const adjust = useAdjustDay();
  const toast = useToast();

  const allocated = rows.reduce((sum, row) => sum + row.minutes, 0);
  const splitReady =
    rows.every((row) => row.date !== null && row.minutes > 0) && allocated === minutes;
  const canSubmit =
    minutes > 0 &&
    minutes <= target.maxMinutes &&
    (mode !== 'split' || splitReady) &&
    !adjust.isPending;

  const updateRow = (key: number, patch: Partial<SplitRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const submit = () => {
    adjust.mutate(
      {
        planId: target.planId,
        fromDate: target.fromDate,
        minutes,
        mode,
        items:
          mode === 'split'
            ? rows.map((row) => ({ date: row.date as string, minutes: row.minutes }))
            : undefined,
      },
      {
        onSuccess: (result) => {
          const where =
            result.items.length === 1
              ? formatShortDate(result.items[0].date)
              : `${result.items.length} 天`;
          toast.show(`已把 ${formatMinutes(minutes)} 安排到 ${where}`, 'success');
          onDone();
        },
        onError: toast.error,
      },
    );
  };

  return (
    <div className={styles.form}>
      <Field label="要挪走的时长" as="div" hint={`最多 ${formatMinutes(target.maxMinutes)}`}>
        <DurationInput
          ariaLabel="要挪走的时长"
          minutes={minutes}
          maxHours={Math.floor(target.maxMinutes / 60)}
          onChange={(value) => setMinutes(Math.min(value, target.maxMinutes))}
        />
      </Field>

      <Field label="挪到哪里" as="div" hint={MODE_HINT[mode]}>
        <SegmentedControl
          ariaLabel="处理方式"
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
          block
        />
      </Field>

      {mode === 'split' && (
        <div className={styles.split}>
          {rows.map((row, index) => (
            <div key={row.key} className={styles.splitRow}>
              <span className={styles.splitIndex}>{index + 1}</span>
              <DatePicker
                ariaLabel={`第 ${index + 1} 段的日期`}
                value={row.date}
                today={today}
                min={today}
                isDisabled={(date) =>
                  date === target.fromDate ||
                  rows.some((other) => other.key !== row.key && other.date === date)
                }
                onChange={(date) => updateRow(row.key, { date })}
              />
              <DurationInput
                ariaLabel={`第 ${index + 1} 段的时长`}
                minutes={row.minutes}
                onChange={(value) => updateRow(row.key, { minutes: value })}
              />
              <Button
                iconOnly
                size="sm"
                variant="plain"
                aria-label="删除这一段"
                disabled={rows.length === 1}
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              >
                <TrashIcon />
              </Button>
            </div>
          ))}
          <div className={styles.splitFooter}>
            <Button
              size="sm"
              variant="plain"
              onClick={() =>
                setRows((current) => [
                  ...current,
                  {
                    key: Math.max(...current.map((row) => row.key)) + 1,
                    date: null,
                    minutes: Math.max(0, minutes - allocated),
                  },
                ])
              }
            >
              <PlusIcon />
              再加一段
            </Button>
            <span className={allocated === minutes ? styles.sumOk : styles.sumBad}>
              已安排 {formatMinutes(allocated)} / 共 {formatMinutes(minutes)}
            </span>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <Button onClick={onDone}>取消</Button>
        <Button variant="primary" disabled={!canSubmit} onClick={submit}>
          确认调整
        </Button>
      </div>
    </div>
  );
}
