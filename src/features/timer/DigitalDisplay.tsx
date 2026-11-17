import { useEffect, useRef } from 'react';
import { springStep, mod } from './feel/spring';
import type { DialUnit } from './feel/preset';
import type { DialController } from './dial/controller';
import { digitalDragSeconds } from './dial/digitalDrag';
import { DIGIT_REELS, dialValues, reelPositions } from './dial/reels';
import { fadeInText } from './dial/fadeInText';
import styles from './DigitalDisplay.module.css';

const COLUMNS: { unit: DialUnit; label: string; reels: number[] }[] = [
  { unit: 3600, label: '小时', reels: [0, 1] },
  { unit: 60, label: '分钟', reels: [2, 3] },
  { unit: 1, label: '秒', reels: [4, 5] },
];
const KEY_STEPS: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };

/**
 * 电子计时器：每一位是一条竖着的数字带，像里程表一样滚动。
 * 时、分、秒都能按住上下拖（往上加、往下减），也能用滚轮和方向键；每帧由控制器驱动，直接改 DOM。
 */
export function DigitalDisplay({ controller }: { controller: DialController }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const stripRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 每帧：算出每一位的位置；切换倒计时 / 正计时时，每一位沿最短方向滚到新值
  useEffect(() => {
    const extras = DIGIT_REELS.map(() => ({ extra: 0, vel: 0, shown: 0 }));
    let lastDisplay: string | null = null;
    let lastAt: number | null = null;
    let lastOver: boolean | null = null;
    return controller.subscribe((frame) => {
      const dt = lastAt === null ? 0 : Math.min(0.05, (frame.t - lastAt) / 1000);
      lastAt = frame.t;
      const values = dialValues(
        frame.display,
        frame.targetSeconds,
        frame.learnedShown,
        frame.offset,
      );
      const active = frame.mode === 'idle' ? 1 : frame.unit;
      const positions = reelPositions(values.base, values.offset, active);
      const morph = lastDisplay !== null && lastDisplay !== frame.display;
      lastDisplay = frame.display;
      positions.forEach((pos, i) => {
        const reel = DIGIT_REELS[i];
        const state = extras[i];
        if (morph) state.extra = mod(state.shown - pos + reel.base / 2, reel.base) - reel.base / 2;
        if (state.extra !== 0 || state.vel !== 0) {
          const [x, v] = springStep(state.extra, state.vel, 13, dt);
          const done = Math.abs(x) < 0.001 && Math.abs(v) < 0.01;
          state.extra = done ? 0 : x;
          state.vel = done ? 0 : v;
        }
        state.shown = mod(pos + state.extra, reel.base);
        const strip = stripRefs.current[i];
        if (strip)
          strip.style.transform = `translateY(calc(var(--row) * ${(-state.shown).toFixed(4)}))`;
      });
      if (values.over !== lastOver) {
        rootRef.current?.classList.toggle(styles.over, values.over);
        lastOver = values.over;
      }
      // 加号只在倒计时的「额外学习」里出现；正计时超过目标只变色
      rootRef.current?.classList.toggle(
        styles.signed,
        values.over && frame.display === 'countDown',
      );
      const label =
        frame.display === 'countDown'
          ? values.over
            ? '额外学习'
            : '剩余'
          : frame.targetSeconds > 0
            ? '今天已学'
            : '今天已学（今天没有目标）';
      fadeInText(labelRef.current, label);
      COLUMNS.forEach((column, i) => {
        colRefs.current[i]?.classList.toggle(
          styles.active,
          frame.owner === 'digital' && frame.part === String(column.unit),
        );
      });
    });
  }, [controller]);

  // 滚轮要能阻止页面滚动，只能用非被动监听
  useEffect(() => {
    const cleanups = COLUMNS.map((column, i) => {
      const col = colRefs.current[i];
      if (!col) return () => {};
      let acc = 0;
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const px =
          event.deltaMode === 1
            ? event.deltaY * 33
            : event.deltaMode === 2
              ? event.deltaY * 100
              : event.deltaY;
        // 鼠标滚轮一格约 100 像素；触控板是很多小步，攒够一整格再走
        acc += (-px / 100) * controller.engine.preset.wheel[column.unit];
        while (Math.abs(acc) >= 1) {
          const step = acc > 0 ? 1 : -1;
          acc -= step;
          controller.nudge('digital', String(column.unit), column.unit, step, Date.now());
        }
      };
      col.addEventListener('wheel', onWheel, { passive: false });
      return () => col.removeEventListener('wheel', onWheel);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [controller]);

  return (
    <div className={styles.display} ref={rootRef}>
      <span className={styles.label} ref={labelRef} />
      <div className={styles.digits}>
        <span className={styles.plus} aria-hidden="true">
          +
        </span>
        {COLUMNS.map((column, i) => (
          <DigitColumn
            key={column.unit}
            column={column}
            controller={controller}
            colRef={(el) => {
              colRefs.current[i] = el;
            }}
            stripRef={(reel, el) => {
              stripRefs.current[reel] = el;
            }}
            withColon={i > 0}
          />
        ))}
      </div>
    </div>
  );
}

function DigitColumn({
  column,
  controller,
  colRef,
  stripRef,
  withColon,
}: {
  column: (typeof COLUMNS)[number];
  controller: DialController;
  colRef: (el: HTMLDivElement | null) => void;
  stripRef: (reel: number, el: HTMLSpanElement | null) => void;
  withColon: boolean;
}) {
  const drag = useRef<{ y: number; t: number; rowPx: number } | null>(null);
  const { unit } = column;
  const preset = controller.engine.preset;

  return (
    <>
      {withColon && (
        <span className={styles.colon} aria-hidden="true">
          :
        </span>
      )}
      <div
        ref={colRef}
        className={styles.col}
        role="slider"
        tabIndex={0}
        aria-label={`拖动调整${column.label}`}
        aria-valuetext={column.label}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // 没有真实指针（如脚本合成的事件）时跳过
          }
          // 一格数字的高度：量数字窗口（正好一格高），不能量整条数字带（7 格或 11 格高）
          const reel = event.currentTarget.querySelector(`.${CSS.escape(styles.reel)}`);
          drag.current = {
            y: event.clientY,
            t: event.timeStamp,
            rowPx: reel?.getBoundingClientRect().height || 100,
          };
          controller.grab('digital', String(unit), unit, Date.now());
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state) return;
          const dy = event.clientY - state.y;
          const dtMs = event.timeStamp - state.t;
          state.y = event.clientY;
          state.t = event.timeStamp;
          controller.drag(digitalDragSeconds(dy, dtMs, state.rowPx, unit, preset), Date.now());
        }}
        onPointerUp={() => {
          if (!drag.current) return;
          drag.current = null;
          controller.release(Date.now());
        }}
        onPointerCancel={() => {
          if (!drag.current) return;
          drag.current = null;
          controller.release(Date.now());
        }}
        onKeyDown={(event) => {
          const steps = KEY_STEPS[event.key];
          if (!steps) return;
          event.preventDefault();
          controller.nudge('digital', String(unit), unit, steps, Date.now());
        }}
      >
        {column.reels.map((reelIndex) => {
          const reel = DIGIT_REELS[reelIndex];
          return (
            <span key={reelIndex} className={styles.reel}>
              <span className={styles.strip} ref={(el) => stripRef(reelIndex, el)}>
                {Array.from({ length: reel.base + 1 }, (_, digit) => (
                  <span key={digit}>{digit % reel.base}</span>
                ))}
              </span>
            </span>
          );
        })}
      </div>
    </>
  );
}
