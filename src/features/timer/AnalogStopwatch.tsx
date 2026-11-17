import { useEffect, useRef } from 'react';
import { formatClock } from '../../lib/format';
import type { DialUnit } from './feel/preset';
import { mod } from './feel/spring';
import type { DialController } from './dial/controller';
import { fadeInText } from './dial/fadeInText';
import { dialValues } from './dial/reels';
import styles from './AnalogStopwatch.module.css';

const SIZE = 260;
const C = SIZE / 2;
const R = 118;
const SUB = { cx: C, cy: C + 44, r: 24 };

type Hand = 'hour' | 'minute' | 'second';
/** 每根针转一圈是多少秒、松手时吸附到多少秒一格 */
const HANDS: Record<Hand, { cycle: number; unit: DialUnit }> = {
  second: { cycle: 60, unit: 1 },
  minute: { cycle: 3600, unit: 60 },
  hour: { cycle: 43200, unit: 3600 },
};

function polar(angleDeg: number, radius: number, cx = C, cy = C) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/** 从 12 点方向顺时针到 angle 的扇形 */
function sectorPath(angleDeg: number, radius: number): string {
  if (angleDeg <= 0) return '';
  if (angleDeg >= 359.99) {
    return `M ${C} ${C - radius} A ${radius} ${radius} 0 1 1 ${C - 0.01} ${C - radius} Z`;
  }
  const end = polar(angleDeg, radius);
  const large = angleDeg > 180 ? 1 : 0;
  return `M ${C} ${C} L ${C} ${C - radius} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

function setLine(
  el: SVGLineElement | null,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  if (!el) return;
  el.setAttribute('x1', from.x.toFixed(2));
  el.setAttribute('y1', from.y.toFixed(2));
  el.setAttribute('x2', to.x.toFixed(2));
  el.setAttribute('y2', to.y.toFixed(2));
}

const angleOf = (x: number, y: number, cx: number, cy: number) =>
  mod((Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90, 360);
const angleGap = (a: number, b: number) => Math.abs(mod(a - b + 180, 360) - 180);

/**
 * 物理小秒表：主表盘一圈 60 分钟，蓝色细针每 60 秒一圈，小表盘一圈 12 小时；
 * 倒计时时彩色扇形表示剩余（最多一小时），超出目标后表盘变为橙色。
 * 三根针都能按住转动：点在小表盘上抓小时针，否则抓离点击方向最近的分针或秒针。
 */
export function AnalogStopwatch({ controller }: { controller: DialController }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sectorRef = useRef<SVGPathElement>(null);
  const handRefs = useRef<Record<Hand, SVGLineElement | null>>({
    hour: null,
    minute: null,
    second: null,
  });
  const labelRef = useRef<HTMLSpanElement>(null);
  const digitsRef = useRef<HTMLSpanElement>(null);
  const angles = useRef<Record<Hand, number>>({ hour: 0, minute: 0, second: 0 });
  const drag = useRef<{ hand: Hand; cx: number; cy: number; angle: number } | null>(null);

  useEffect(() => {
    let lastDisplay: string | null = null;
    let morph: { from: Record<Hand, number>; t0: number } | null = null;
    let lastSector = '';
    let lastDigits = '';
    return controller.subscribe((frame) => {
      const values = dialValues(
        frame.display,
        frame.targetSeconds,
        frame.learnedLive,
        frame.offset,
      );
      const seconds = Math.max(0, values.base + values.offset);
      const target: Record<Hand, number> = {
        minute: (mod(seconds, 3600) / 3600) * 360,
        second: (mod(seconds, 60) / 60) * 360,
        hour: (((seconds / 3600) % 12) / 12) * 360,
      };
      // 切换倒计时 / 正计时：三根针各自沿最短方向转到新位置
      if (lastDisplay !== null && lastDisplay !== frame.display) {
        morph = { from: { ...angles.current }, t0: frame.t };
      }
      lastDisplay = frame.display;
      let k = 1;
      if (morph) {
        const x = Math.min(1, (frame.t - morph.t0) / 650);
        k = 1 - Math.pow(1 - x, 3);
      }
      for (const hand of Object.keys(target) as Hand[]) {
        angles.current[hand] = morph
          ? target[hand] + (mod(morph.from[hand] - target[hand] + 180, 360) - 180) * (1 - k)
          : target[hand];
      }
      if (k >= 1) morph = null;

      const a = angles.current;
      setLine(handRefs.current.minute, { x: C, y: C }, polar(a.minute, 74));
      setLine(handRefs.current.second, polar(a.second + 180, 18), polar(a.second, 100));
      setLine(
        handRefs.current.hour,
        { x: SUB.cx, y: SUB.cy },
        polar(a.hour, SUB.r - 6, SUB.cx, SUB.cy),
      );
      for (const hand of Object.keys(HANDS) as Hand[]) {
        handRefs.current[hand]?.classList.toggle(
          styles.active,
          frame.owner === 'analog' && frame.part === hand,
        );
      }

      const countDown = frame.display === 'countDown' && !values.over;
      if (countDown) {
        const d = sectorPath((Math.min(seconds, 3600) / 3600) * 360, R - 14);
        if (d !== lastSector) {
          lastSector = d;
          sectorRef.current?.setAttribute('d', d);
        }
      }
      const root = rootRef.current;
      root?.classList.toggle(styles.noSector, !countDown);
      root?.classList.toggle(styles.overtime, values.over);
      root?.classList.toggle(styles.dragging, frame.owner === 'analog' && frame.mode === 'drag');

      const label =
        frame.display === 'countDown' ? (values.over ? '额外学习' : '剩余') : '今天已学';
      fadeInText(labelRef.current, label);
      const digits = `${values.over && frame.display === 'countDown' ? '+' : ''}${formatClock(seconds)}`;
      if (digits !== lastDigits && digitsRef.current) {
        lastDigits = digits;
        digitsRef.current.textContent = digits;
        svgRef.current?.setAttribute('aria-label', `${label} ${digits}`);
      }
    });
  }, [controller]);

  const svgPoint = (event: React.PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * SIZE) / rect.width,
      y: ((event.clientY - rect.top) * SIZE) / rect.height,
    };
  };

  return (
    <div className={styles.watch} ref={rootRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={styles.svg}
        role="img"
        aria-label="物理秒表"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          const p = svgPoint(event);
          let hand: Hand;
          // 小表盘小，可点范围比看到的大一圈
          if (Math.hypot(p.x - SUB.cx, p.y - SUB.cy) <= SUB.r + 12) {
            hand = 'hour';
          } else {
            const a = angleOf(p.x, p.y, C, C);
            hand =
              angleGap(a, angles.current.minute) <= angleGap(a, angles.current.second)
                ? 'minute'
                : 'second';
          }
          const center = hand === 'hour' ? { cx: SUB.cx, cy: SUB.cy } : { cx: C, cy: C };
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // 没有真实指针（如脚本合成的事件）时跳过
          }
          drag.current = { hand, ...center, angle: angleOf(p.x, p.y, center.cx, center.cy) };
          controller.grab('analog', hand, HANDS[hand].unit, Date.now());
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state) return;
          const p = svgPoint(event);
          const a = angleOf(p.x, p.y, state.cx, state.cy);
          const delta = mod(a - state.angle + 180, 360) - 180; // 跨过 12 点时也连续
          state.angle = a;
          const { cycle, unit } = HANDS[state.hand];
          // 速度 1 时指针正好跟着鼠标转
          controller.drag((delta / 360) * cycle * controller.engine.preset.speed[unit], Date.now());
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
      >
        <circle cx={C} cy={C} r={R} className={styles.face} />
        <path ref={sectorRef} className={styles.sector} d="" />

        {Array.from({ length: 60 }, (_, index) => {
          const major = index % 5 === 0;
          const outer = polar(index * 6, R - 6);
          const inner = polar(index * 6, R - (major ? 18 : 12));
          return (
            <line
              key={index}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className={major ? styles.tickMajor : styles.tick}
            />
          );
        })}
        {Array.from({ length: 12 }, (_, index) => {
          const value = index === 0 ? 60 : index * 5;
          const point = polar(index * 30, R - 34);
          return (
            <text key={value} x={point.x} y={point.y} className={styles.number}>
              {value}
            </text>
          );
        })}

        {/* 小时小表盘 */}
        <circle cx={SUB.cx} cy={SUB.cy} r={SUB.r} className={styles.subFace} />
        {Array.from({ length: 12 }, (_, index) => {
          const outer = polar(index * 30, SUB.r - 2, SUB.cx, SUB.cy);
          const inner = polar(index * 30, SUB.r - (index % 3 === 0 ? 7 : 5), SUB.cx, SUB.cy);
          return (
            <line
              key={index}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className={styles.tick}
            />
          );
        })}
        <line
          ref={(el) => {
            handRefs.current.hour = el;
          }}
          className={styles.hourHand}
        />
        <text x={SUB.cx} y={SUB.cy + 13} className={styles.subLabel}>
          小时
        </text>

        {/* 指针 */}
        <line
          ref={(el) => {
            handRefs.current.minute = el;
          }}
          className={styles.minuteHand}
        />
        <line
          ref={(el) => {
            handRefs.current.second = el;
          }}
          className={styles.secondHand}
        />
        <circle cx={C} cy={C} r={5} className={styles.cap} />
        <circle cx={C} cy={C} r={2} className={styles.capInner} />
      </svg>
      <div className={styles.readout}>
        <span className={styles.label} ref={labelRef} />
        <span className={styles.digits} ref={digitsRef} />
      </div>
    </div>
  );
}
