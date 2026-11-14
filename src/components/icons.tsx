import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/** 应用标志：一个未闭合的进度环 */
export function LogoMark(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.16" strokeWidth="3" />
      <path
        d="M10 3a7 7 0 1 1-7 7"
        stroke="var(--color-accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 大号进度环，用于空状态等展示位 */
export function ProgressRing({
  progress,
  ...props
}: IconProps & { /** 0 ~ 1 */ progress: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" {...props}>
      <circle cx="50" cy="50" r={radius} stroke="var(--color-fill)" strokeWidth="12" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        stroke="var(--color-accent)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${circumference * clamped} ${circumference}`}
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15.5"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.5" cy="13.5" r="1.1" fill="currentColor" />
      <circle cx="12" cy="13.5" r="1.1" fill="currentColor" />
      <circle cx="15.5" cy="13.5" r="1.1" fill="currentColor" />
      <circle cx="8.5" cy="17" r="1.1" fill="currentColor" />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function StopwatchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="13.5" r="7.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2.75h4M12 2.75V6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M18.5 6.5l1.5-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 13.5V9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="13.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function AdjustIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 7.5h11.5M4 16.5h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M17 4.5l3 3-3 3M13 13.5l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 16.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* 窗口按钮图形，沿用 Windows 11 的线条样式 */

export function MinimizeGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" {...props}>
      <path d="M0 5.5h10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function MaximizeGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true" {...props}>
      <rect x="0.5" y="0.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function RestoreGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true" {...props}>
      <rect x="0.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1" />
      <path
        d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

export function CloseGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" {...props}>
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
