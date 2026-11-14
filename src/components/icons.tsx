import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/** 应用标志：一个未闭合的进度环 */
export function LogoMark(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path
        d="M10 3a7 7 0 1 1-7 7"
        stroke="var(--color-accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="4" width="14" height="13" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="11.5" r="1" fill="currentColor" />
      <circle cx="10" cy="11.5" r="1" fill="currentColor" />
      <circle cx="13" cy="11.5" r="1" fill="currentColor" />
      <circle cx="7" cy="14.5" r="1" fill="currentColor" />
      <circle cx="10" cy="14.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8.4 2.6a1.6 1.6 0 0 1 3.2 0l.1.6a1.6 1.6 0 0 0 2.3 1l.6-.3a1.6 1.6 0 0 1 2.2 2.2l-.3.6a1.6 1.6 0 0 0 1 2.3l.6.1a1.6 1.6 0 0 1 0 3.2l-.6.1a1.6 1.6 0 0 0-1 2.3l.3.6a1.6 1.6 0 0 1-2.2 2.2l-.6-.3a1.6 1.6 0 0 0-2.3 1l-.1.6a1.6 1.6 0 0 1-3.2 0l-.1-.6a1.6 1.6 0 0 0-2.3-1l-.6.3a1.6 1.6 0 0 1-2.2-2.2l.3-.6a1.6 1.6 0 0 0-1-2.3l-.6-.1a1.6 1.6 0 0 1 0-3.2l.6-.1a1.6 1.6 0 0 0 1-2.3l-.3-.6a1.6 1.6 0 0 1 2.2-2.2l.6.3a1.6 1.6 0 0 0 2.3-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/* 标题栏按钮图形，沿用 Windows 11 的线条样式 */

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
