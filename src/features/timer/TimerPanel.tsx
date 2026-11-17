import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useClock, usePlans, useSettings, useTimerStatus } from '../../api/hooks';
import type { DayPlanEntry, TimerDisplay, TimerStyle } from '../../api/types';
import { PauseIcon, PlayIcon } from '../../components/icons';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { zonedTimeToMs } from '../../lib/dates';
import { formatMinutes, formatSeconds } from '../../lib/format';
import { planColorVar } from '../../lib/planColors';
import { AdjustBadge } from './AdjustBadge';
import { AnalogStopwatch } from './AnalogStopwatch';
import { DigitalDisplay } from './DigitalDisplay';
import { useDialController } from './dial/useDialController';
import { publishLiveLearned } from './liveLearned';
import styles from './TimerPanel.module.css';

const DISPLAY_OPTIONS: { value: TimerDisplay; label: string }[] = [
  { value: 'countDown', label: '倒计时' },
  { value: 'countUp', label: '正计时' },
];

const STYLE_OPTIONS: { value: TimerStyle; label: string }[] = [
  { value: 'digital', label: '电子计时器' },
  { value: 'analog', label: '物理秒表' },
];

/** 按住拖动计时器时，整页显示握拳的手 */
const GRABBING_CLASS = 'dial-grabbing';

/**
 * 今天的计时器：选计划、开始 / 暂停、正计时 / 倒计时、两种外观。
 * 两种外观都能拖动调整今天已学（#36），显示由拖动控制器按帧驱动。
 */
export function TimerPanel({ entries }: { entries: DayPlanEntry[] }) {
  const { data: status } = useTimerStatus();
  const { data: settings } = useSettings();
  const { data: plans } = usePlans();
  const { data: clock } = useClock();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [display, setDisplay] = useState<TimerDisplay | null>(null);
  const [style, setStyle] = useState<TimerStyle | null>(null);
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef<HTMLParagraphElement>(null);

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
  const entry = entries.find((item) => item.planId === selected);
  const progress = runningSelected && status?.planToday ? status.planToday : null;
  const targetMinutes = progress ? progress.targetMinutes : (entry?.targetMinutes ?? 0);
  const today = status?.today ?? clock?.today;

  const controller = useDialController({
    planId: selected,
    targetSeconds: targetMinutes * 60,
    display: effectiveDisplay,
    running: runningSelected,
    studiedSeconds: progress ? progress.studiedSeconds : (entry?.studiedSeconds ?? 0),
    studiedAt: progress && status ? status.nowMs : 0,
    dayStartMs: today ? zonedTimeToMs(today, '00:00', clock?.timezone ?? 'UTC') : 0,
  });

  // 「今天目标…，已学…」和顶部计时胶囊按本地时钟模型显示（含拖动中的调整），以及按住时的握拳光标
  useEffect(() => {
    const root = document.documentElement;
    const unsubscribe = controller.subscribe((frame) => {
      const learned = Math.max(0, frame.learnedLive + frame.offset);
      publishLiveLearned(frame.planId === null ? null : { planId: frame.planId, seconds: learned });
      const text =
        frame.targetSeconds > 0
          ? `今天目标 ${formatMinutes(frame.targetSeconds / 60)}，已学 ${formatSeconds(learned)}`
          : `今天没有分配目标，已学 ${formatSeconds(learned)}`;
      if (summaryRef.current && summaryRef.current.textContent !== text) {
        summaryRef.current.textContent = text;
      }
      root.classList.toggle(GRABBING_CLASS, frame.mode === 'drag');
    });
    return () => {
      unsubscribe();
      publishLiveLearned(null);
      root.classList.remove(GRABBING_CLASS);
    };
  }, [controller]);

  if (choices.length === 0) return null;

  // 开始 / 暂停也走拖动控制器的请求队列，保证和拖动产生的「暂停 / 接着计时」按顺序执行
  const toggle = () => {
    if (selected === null) return;
    setBusy(true);
    void controller
      .run(async () => {
        if (runningSelected) {
          await api.stopTimer();
          return;
        }
        if (running) await api.stopTimer();
        await api.startTimer(selected);
      })
      .finally(() => setBusy(false));
  };

  const otherRunning = running !== null && !runningSelected;
  const runningName = choices.find((plan) => plan.id === running?.planId)?.name;
  const owner = effectiveStyle === 'analog' ? 'analog' : 'digital';

  return (
    <section className={styles.panel} aria-label="计时器">
      <div className={styles.dial}>
        {effectiveStyle === 'analog' ? (
          <AnalogStopwatch controller={controller} />
        ) : (
          <DigitalDisplay controller={controller} />
        )}
        <AdjustBadge controller={controller} owner={owner} />
        <p className={styles.summary} ref={summaryRef} />
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
          onClick={toggle}
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
