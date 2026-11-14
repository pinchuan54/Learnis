import type { ReactNode } from 'react';

interface ProgressRingProps {
  /** 0 ~ 1，超过 1 按满圈显示 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  className?: string;
  /** 圆环中间的内容 */
  children?: ReactNode;
  label?: string;
}

/** 进度环（类似 Apple 健身圆环） */
export function ProgressRing({
  progress,
  size = 40,
  stroke = 4,
  color = 'var(--color-accent)',
  trackColor = 'var(--color-fill)',
  className,
  children,
  label,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const center = size / 2;

  return (
    <span
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        <circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={stroke} />
        {clamped > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * clamped} ${circumference}`}
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: 'stroke-dasharray 400ms var(--ease-standard)' }}
          />
        )}
      </svg>
      {children && (
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          {children}
        </span>
      )}
    </span>
  );
}
