import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useClock, useCreatePlan, useUpdatePlan } from '../../api/hooks';
import type { Plan, PlanColor, PlanInput } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { DurationInput } from '../../components/ui/DurationInput';
import { Field } from '../../components/ui/Field';
import forms from '../../components/ui/forms.module.css';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/toast/ToastContext';
import { addDays, WEEKDAY_SHORT } from '../../lib/dates';
import { formatMinutes } from '../../lib/format';
import { PLAN_COLORS, planColorVar } from '../../lib/planColors';
import { ALL_WEEKDAYS, hasWeekday, toggleWeekday } from '../../lib/weekdays';
import styles from './PlanSheet.module.css';

interface PlanSheetProps {
  open: boolean;
  onClose: () => void;
  /** 传入则为编辑，否则为新建 */
  plan?: Plan | null;
}

function initialInput(plan: Plan | null | undefined, today: string): PlanInput {
  if (plan) {
    return {
      name: plan.name,
      goal: plan.goal,
      color: plan.color,
      totalMinutes: plan.totalMinutes,
      startDate: plan.startDate,
      endDate: plan.endDate,
      studyWeekdays: plan.studyWeekdays,
    };
  }
  return {
    name: '',
    goal: '',
    color: 'blue',
    totalMinutes: 100 * 60,
    startDate: today,
    endDate: addDays(today, 29),
    studyWeekdays: ALL_WEEKDAYS,
  };
}

/** 新建 / 编辑计划 */
export function PlanSheet({ open, onClose, plan }: PlanSheetProps) {
  const { data: clock } = useClock();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={plan ? '编辑计划' : '新建计划'}
      description="设定总时长和期限，Learnis 会把时长均分到期限内的每个学习日。"
      width={560}
    >
      {open && clock && <PlanForm plan={plan} today={clock.today} onDone={onClose} />}
    </Sheet>
  );
}

function PlanForm({
  plan,
  today,
  onDone,
}: {
  plan?: Plan | null;
  today: string;
  onDone: () => void;
}) {
  const [input, setInput] = useState<PlanInput>(() => initialInput(plan, today));
  const [debounced, setDebounced] = useState(input);
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const toast = useToast();

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(input), 250);
    return () => window.clearTimeout(id);
  }, [input]);

  const preview = useQuery({
    queryKey: ['plan-preview', debounced],
    queryFn: () => api.previewPlan(debounced),
    enabled: debounced.name.trim() !== '' || debounced.totalMinutes > 0,
    retry: false,
  });

  const update = <K extends keyof PlanInput>(key: K, value: PlanInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));

  const nameMissing = input.name.trim() === '';
  const pending = createPlan.isPending || updatePlan.isPending;

  const submit = () => {
    const options = {
      onSuccess: () => {
        toast.show(plan ? '计划已更新' : '计划已创建', 'success');
        onDone();
      },
      onError: (error: unknown) => toast.error(error),
    };
    if (plan) updatePlan.mutate({ id: plan.id, input }, options);
    else createPlan.mutate(input, options);
  };

  const previewText = (() => {
    if (preview.isError) return { error: true, text: preview.error.message };
    if (!preview.data) return null;
    const { studyDayCount, minDailyMinutes, maxDailyMinutes } = preview.data;
    const daily =
      minDailyMinutes === maxDailyMinutes
        ? formatMinutes(minDailyMinutes)
        : `${formatMinutes(minDailyMinutes)} ~ ${formatMinutes(maxDailyMinutes)}`;
    return { error: false, text: `共 ${studyDayCount} 个学习日，每天 ${daily}` };
  })();

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!nameMissing) submit();
      }}
    >
      <Field label="计划名称">
        <input
          className={forms.input}
          value={input.name}
          maxLength={40}
          placeholder="例如：After Effects"
          autoFocus
          onChange={(event) => update('name', event.target.value)}
        />
      </Field>

      <Field label="目标说明" hint="想达到什么水平，可选">
        <textarea
          className={forms.textarea}
          value={input.goal}
          maxLength={500}
          placeholder="例如：能独立完成商业级片头动画"
          onChange={(event) => update('goal', event.target.value)}
        />
      </Field>

      <Field label="总时长" as="div">
        <DurationInput
          ariaLabel="总时长"
          minutes={input.totalMinutes}
          maxHours={99_999}
          onChange={(minutes) => update('totalMinutes', minutes)}
        />
      </Field>

      <div className={forms.row}>
        <Field label="开始日期" as="div">
          <DatePicker
            ariaLabel="开始日期"
            value={input.startDate}
            today={today}
            onChange={(date) => update('startDate', date)}
          />
        </Field>
        <Field label="期限" as="div">
          <DatePicker
            ariaLabel="期限"
            value={input.endDate}
            today={today}
            min={input.startDate}
            onChange={(date) => update('endDate', date)}
          />
        </Field>
      </div>

      <Field label="学习日" as="div" hint="不勾选的日子不分配时长">
        <div className={styles.weekdays} role="group" aria-label="学习日">
          {WEEKDAY_SHORT.map((label, index) => {
            const checked = hasWeekday(input.studyWeekdays, index);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={checked}
                className={checked ? `${styles.weekday} ${styles.weekdayOn}` : styles.weekday}
                onClick={() => {
                  const next = toggleWeekday(input.studyWeekdays, index);
                  if (next !== 0) update('studyWeekdays', next);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="颜色" as="div">
        <div className={styles.colors} role="radiogroup" aria-label="颜色">
          {PLAN_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              role="radio"
              aria-checked={input.color === color.value}
              aria-label={color.label}
              className={styles.swatch}
              style={{ background: planColorVar(color.value) }}
              onClick={() => update('color', color.value as PlanColor)}
            />
          ))}
        </div>
      </Field>

      {plan && (
        <p className={styles.note}>
          修改总时长、日期或学习日后，今天及以后的每日目标会重新均分；已做的调整保持不变。
        </p>
      )}

      {/* 固定在面板底部：分配预览 + 操作按钮 */}
      <div className={styles.footer}>
        <p className={previewText?.error ? styles.previewError : styles.preview}>
          {previewText?.text ?? ''}
        </p>
        <div className={styles.actions}>
          <Button onClick={onDone}>取消</Button>
          <Button type="submit" variant="primary" disabled={nameMissing || pending}>
            {plan ? '保存' : '创建计划'}
          </Button>
        </div>
      </div>
    </form>
  );
}
