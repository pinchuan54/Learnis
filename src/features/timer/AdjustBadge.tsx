import { useEffect, useRef } from 'react';
import { formatSeconds } from '../../lib/format';
import { mod, springStep } from './feel/spring';
import type { DialController, DialOwner } from './dial/controller';
import { BADGE_SLOTS, type BadgeSlot, badgeDigits } from './dial/reels';
import styles from './AdjustBadge.module.css';

type Tone = 'plus' | 'minus' | 'zero';
const SIGNS: [Tone, string][] = [
  ['plus', '+'],
  ['minus', '−'],
  ['zero', '±'],
];

interface SlotState {
  digit: number;
  pos: number;
  vel: number;
  target: number;
  drawn: number;
}

/**
 * 这一轮调整的合计（#36）：只有符号和数字，每一位像主计时器一样滚动，位数变化时宽度平滑伸缩；
 * 加是绿色、减是红色。松手后带撤销图标（整轮撤销）。只出现在正在操作的那个表下面。
 */
export function AdjustBadge({
  controller,
  owner,
}: {
  controller: DialController;
  owner: DialOwner;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const signRefs = useRef<Partial<Record<Tone, HTMLSpanElement | null>>>({});
  const slotRefs = useRef<Partial<Record<BadgeSlot, HTMLSpanElement | null>>>({});
  const stripRefs = useRef<Partial<Record<BadgeSlot, HTMLSpanElement | null>>>({});
  const undoRef = useRef<HTMLButtonElement>(null);
  const limitRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const slots = Object.fromEntries(
      BADGE_SLOTS.map((slot) => [slot, { digit: 0, pos: 0, vel: 0, target: 0, drawn: Number.NaN }]),
    ) as Record<BadgeSlot, SlotState>;
    let value = -1;
    let shown = false;
    let tone: Tone | null = null;
    let canUndo = false;
    let aria = '';
    let lastAt: number | null = null;
    let limitText = '';

    return controller.subscribe((frame) => {
      const root = rootRef.current;
      if (!root) return;
      const dt = lastAt === null ? 0 : Math.min(0.05, (frame.t - lastAt) / 1000);
      lastAt = frame.t;
      const badge = frame.badge;
      const on = badge.visible && badge.owner === owner;

      if (on) {
        // 拆成各位数字；数值变大时数字带往上滚，变小时往下滚；刚出现时直接到位
        const seconds = Math.abs(Math.round(badge.sum));
        if (seconds !== value || !shown) {
          const instant = !shown;
          const up = seconds > value;
          value = seconds;
          const { digits, visible } = badgeDigits(seconds);
          for (const slot of BADGE_SLOTS) {
            slotRefs.current[slot]?.classList.toggle(styles.gone, !visible[slot]);
            if (slot === 'c1' || slot === 'c2') continue;
            const state = slots[slot];
            const d = digits[slot];
            if (instant) {
              Object.assign(state, { digit: d, pos: d, target: d, vel: 0 });
            } else if (d !== state.digit) {
              state.target += up ? mod(d - state.digit, 10) : -mod(state.digit - d, 10);
              state.digit = d;
            }
          }
        }
        const nextTone: Tone =
          Math.round(badge.sum) === 0 ? 'zero' : badge.sum > 0 ? 'plus' : 'minus';
        if (nextTone !== tone) {
          root.classList.remove(styles.plus, styles.minus, styles.zero);
          root.classList.add(styles[nextTone]);
          for (const [key] of SIGNS)
            signRefs.current[key]?.classList.toggle(styles.on, key === nextTone);
          tone = nextTone;
        }
        const label =
          nextTone === 'zero'
            ? '这一轮没有改动'
            : `这一轮${nextTone === 'plus' ? '增加' : '减少'}了 ${formatSeconds(seconds)}`;
        if (label !== aria) {
          aria = label;
          root.setAttribute('aria-label', label);
        }
      }
      if (on !== shown) {
        root.classList.toggle(styles.shown, on);
        shown = on;
      }
      const undo = on && badge.canUndo;
      if (undo !== canUndo) {
        root.classList.toggle(styles.hasUndo, undo);
        if (undoRef.current) undoRef.current.tabIndex = undo ? 0 : -1;
        canUndo = undo;
      }

      // 每一位的数字带用弹簧滚到目标
      for (const slot of BADGE_SLOTS) {
        if (slot === 'c1' || slot === 'c2') continue;
        const state = slots[slot];
        if (Math.abs(state.target - state.pos) < 0.001 && Math.abs(state.vel) < 0.01) {
          state.pos = state.target = mod(state.target, 10);
          state.vel = 0;
        } else {
          const [x, v] = springStep(state.pos - state.target, state.vel, 20, dt);
          state.pos = state.target + x;
          state.vel = v;
        }
        const p = mod(state.pos, 10);
        if (p !== state.drawn) {
          state.drawn = p;
          const strip = stripRefs.current[slot];
          if (strip) strip.style.transform = `translateY(calc(var(--row) * ${(-p).toFixed(4)}))`;
        }
      }

      // 撞到边界时的说明，跟着正在操作的那个表
      const nextLimit =
        frame.limit !== 0 && badge.owner === owner
          ? frame.limit < 0
            ? '今天已学不能少于 0'
            : '今天已学不能超过今天已经过去的时长'
          : '';
      if (nextLimit !== limitText && limitRef.current) {
        limitText = nextLimit;
        limitRef.current.textContent = nextLimit;
      }
    });
  }, [controller, owner]);

  return (
    <div className={styles.slot}>
      <div className={`${styles.badge} ${styles.zero}`} ref={rootRef} role="status">
        <span className={styles.sign} aria-hidden="true">
          {SIGNS.map(([tone, char]) => (
            <span
              key={tone}
              ref={(el) => {
                signRefs.current[tone] = el;
              }}
            >
              {char}
            </span>
          ))}
        </span>
        {BADGE_SLOTS.map((slot) =>
          slot === 'c1' || slot === 'c2' ? (
            <span
              key={slot}
              className={`${styles.digit} ${styles.colon}`}
              aria-hidden="true"
              ref={(el) => {
                slotRefs.current[slot] = el;
              }}
            >
              :
            </span>
          ) : (
            <span
              key={slot}
              className={styles.digit}
              aria-hidden="true"
              ref={(el) => {
                slotRefs.current[slot] = el;
              }}
            >
              <span
                className={styles.strip}
                ref={(el) => {
                  stripRefs.current[slot] = el;
                }}
              >
                {Array.from({ length: 11 }, (_, digit) => (
                  <span key={digit}>{digit % 10}</span>
                ))}
              </span>
            </span>
          ),
        )}
        <span className={styles.undoWrap}>
          <button
            ref={undoRef}
            type="button"
            className={styles.undo}
            title="撤销"
            aria-label="撤销这一轮调整"
            tabIndex={-1}
            onClick={() => controller.undo()}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M7.5 4.5 3.8 8.2l3.7 3.7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4.3 8.2h7.2a4.3 4.3 0 0 1 0 8.6H9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </span>
      </div>
      <span className={styles.limit} ref={limitRef} />
    </div>
  );
}
