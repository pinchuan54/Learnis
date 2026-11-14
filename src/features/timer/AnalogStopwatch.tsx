import { formatClock } from '../../lib/format';
import type { Readout } from './readout';
import styles from './AnalogStopwatch.module.css';

const SIZE = 260;
const C = SIZE / 2;
const R = 118;

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
  return `M ${C} ${C} L ${C} ${C - radius} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

/**
 * 物理小秒表：
 * - 主表盘一圈 60 分钟，粗指针指示分钟，细指针每 60 秒转一圈；
 * - 下方小表盘一圈 12 小时；
 * - 倒计时时，彩色扇形表示剩余时间（最多一小时），随时间缩小；
 * - 超出目标后表盘变为橙色，指针改为显示额外学习的时长。
 */
export function AnalogStopwatch({ readout }: { readout: Readout }) {
  const seconds = Math.max(0, readout.seconds);
  const minuteAngle = ((seconds % 3600) / 3600) * 360;
  const secondAngle = ((seconds % 60) / 60) * 360;
  const hourAngle = (((seconds / 3600) % 12) / 12) * 360;
  const showSector = readout.mode === 'countDown' && !readout.overtime;
  const sectorAngle = (Math.min(seconds, 3600) / 3600) * 360;
  const sub = { cx: C, cy: C + 44, r: 24 };

  const minuteTip = polar(minuteAngle, 74);
  const secondTip = polar(secondAngle, 100);
  const secondTail = polar(secondAngle + 180, 18);
  const hourTip = polar(hourAngle, sub.r - 6, sub.cx, sub.cy);

  return (
    <div className={readout.overtime ? `${styles.watch} ${styles.overtime}` : styles.watch}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={styles.svg}
        role="img"
        aria-label={`${readout.label} ${formatClock(seconds)}`}
      >
        <circle cx={C} cy={C} r={R} className={styles.face} />
        {showSector && <path d={sectorPath(sectorAngle, R - 14)} className={styles.sector} />}

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
        <circle cx={sub.cx} cy={sub.cy} r={sub.r} className={styles.subFace} />
        {Array.from({ length: 12 }, (_, index) => {
          const outer = polar(index * 30, sub.r - 2, sub.cx, sub.cy);
          const inner = polar(index * 30, sub.r - (index % 3 === 0 ? 7 : 5), sub.cx, sub.cy);
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
        <line x1={sub.cx} y1={sub.cy} x2={hourTip.x} y2={hourTip.y} className={styles.hourHand} />
        <text x={sub.cx} y={sub.cy + 13} className={styles.subLabel}>
          小时
        </text>

        {/* 指针 */}
        <line x1={C} y1={C} x2={minuteTip.x} y2={minuteTip.y} className={styles.minuteHand} />
        <line
          x1={secondTail.x}
          y1={secondTail.y}
          x2={secondTip.x}
          y2={secondTip.y}
          className={styles.secondHand}
        />
        <circle cx={C} cy={C} r={5} className={styles.cap} />
        <circle cx={C} cy={C} r={2} className={styles.capInner} />
      </svg>
      <div className={styles.readout}>
        <span className={styles.label}>{readout.label}</span>
        <span className={styles.digits}>
          {readout.overtime && readout.mode === 'countDown' ? '+' : ''}
          {formatClock(seconds)}
        </span>
      </div>
    </div>
  );
}
