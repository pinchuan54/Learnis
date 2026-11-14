import { useState } from 'react';
import {
  usePlans,
  useSettings,
  useStartTimer,
  useStopTimer,
  useTimerStatus,
} from '../../api/hooks';
import type { DayPlanEntry, TimerDisplay, TimerStyle } from '../../api/types';
import { PauseIcon, PlayIcon } from '../../components/icons';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useToast } from '../../components/ui/toast/ToastContext';
import { useNow } from '../../hooks/useNow';
import { formatMinutes, formatSeconds } from '../../lib/format';
import { planColorVar } from '../../lib/planColors';
import { AnalogStopwatch } from './AnalogStopwatch';
import { DigitalDisplay } from './DigitalDisplay';
import { computeReadout } from './readout';
import styles from './TimerPanel.module.css';

const DISPLAY_OPTIONS: { value: TimerDisplay; label: string }[] = [
  { value: 'countDown', label: '倒计时' },
  { value: 'countUp', label: '正计时' },
];

const STYLE_OPTIONS: { value: TimerStyle; label: string }[] = [
  { value: 'digital', label: '电子计时器' },
  { value: 'analog', label: '物理秒表' },
];

/** 今天的计时器：选计划、开始 / 暂停、正计时 / 倒计时、两种外观 */
export function TimerPanel({ entries }: { entries: DayPlanEntry[] }) {
  const { data: status } = useTimerStatus();
  const { data: settings } = useSettings();
  const { data: plans } = usePlans();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [display, setDisplay] = useState<TimerDisplay | null>(null);
  const [style, setStyle] = useState<TimerStyle | null>(null);

  const running = status?.running ?? null;
  const choices = plans ?? [];
  const selected =
    selectedId ??
    running?.planId ??
    entries.find((entry) => entry.studiedSeconds < entry.targetMinutes * 60)?.planId ??
    entries[0]?.planId ??
    choices[0]?.id ??
    null;
  const effectiveDisplay = display ?? settings?.timerDisplay ?? 'countDown';
  const effectiveStyle = style ?? settings?.timerStyle ?? 'digital';

  const runningSelected = running !== null && running.planId === selected;
  const now = useNow(effectiveStyle === 'analog' ? 'frame' : 250, runningSelected);
  const entry = entries.find((item) => item.planId === selected);
  const targetMinutes =
    runningSelected && status?.planToday
      ? status.planToday.targetMinutes
      : (entry?.targetMinutes ?? 0);
  const studied =
    runningSelected && status?.planToday
      ? status.planToday.studiedSeconds + Math.max(0, (now - status.nowMs) / 1000)
      : (entry?.studiedSeconds ?? 0);
  const readout = computeReadout(effectiveDisplay, targetMinutes * 60, studied);
  const busy = startTimer.isPending || stopTimer.isPending;

  if (choices.length === 0) return null;

  const toggle = async () => {
    if (selected === null) return;
    try {
      if (runningSelected) {
        await stopTimer.mutateAsync(undefined);
        return;
      }
      if (running) await stopTimer.mutateAsync(undefined);
      await startTimer.mutateAsync(selected);
    } catch (error) {
      toast.error(error);
    }
  };

  const otherRunning = running !== null && !runningSelected;
  const runningName = choices.find((plan) => plan.id === running?.planId)?.name;

  return (
    <section className={styles.panel} aria-label="计时器">
      <div className={styles.dial}>
        {effectiveStyle === 'analog' ? (
          <AnalogStopwatch readout={readout} />
        ) : (
          <DigitalDisplay readout={readout} />
        )}
        <p className={styles.summary}>
          {targetMinutes > 0
            ? `今天目标 ${formatMinutes(targetMinutes)}，已学 ${formatSeconds(studied)}`
            : `今天没有分配目标，已学 ${formatSeconds(studied)}`}
        </p>
      </div>

      <div className={styles.side}>
        <div className={styles.plans} role="radiogroup" aria-label="选择计划">
          {choices.map((plan) => (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={plan.id === selected}
              className={plan.id === selected ? `${styles.chip} ${styles.chipOn}` : styles.chip}
              onClick={() => setSelectedId(plan.id)}
            >
              <span className={styles.chipDot} style={{ background: planColorVar(plan.color) }} />
              {plan.name}
              {running?.planId === plan.id && <span className={styles.live}>计时中</span>}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={runningSelected ? `${styles.mainButton} ${styles.pause}` : styles.mainButton}
          disabled={busy || selected === null}
          onClick={() => void toggle()}
        >
          {runningSelected ? <PauseIcon /> : <PlayIcon />}
          <span>{runningSelected ? '暂停' : otherRunning ? '切换到这个计划' : '开始'}</span>
        </button>
        {otherRunning && <p className={styles.hint}>「{runningName}」正在计时，切换会先暂停它。</p>}

        <div className={styles.toggles}>
          <SegmentedControl
            ariaLabel="显示方式"
            size="sm"
            options={DISPLAY_OPTIONS}
            value={effectiveDisplay}
            onChange={setDisplay}
          />
          <SegmentedControl
            ariaLabel="计时器外观"
            size="sm"
            options={STYLE_OPTIONS}
            value={effectiveStyle}
            onChange={setStyle}
          />
        </div>
      </div>
    </section>
  );
}
