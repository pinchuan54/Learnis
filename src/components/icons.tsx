import { type LucideProps, Pause, Play } from 'lucide-react';
import type { SVGProps } from 'react';

// 线条图标统一用 Lucide，在这里改成应用里的名字；换图标只改这一处
export {
  ArrowUpRight as ArrowUpRightIcon,
  CalendarDays as CalendarIcon,
  Check as CheckIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Info as InfoIcon,
  Palette as PaletteIcon,
  Pencil as PencilIcon,
  Plus as PlusIcon,
  Settings as SettingsIcon,
  SlidersHorizontal as SlidersIcon,
  Target as TargetIcon,
  Timer as StopwatchIcon,
  Trash2 as TrashIcon,
  Undo2 as UndoIcon,
} from 'lucide-react';

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

/** 播放 / 暂停用实心图形，和其他线条图标区分开 */
export const PlayIcon = (props: LucideProps) => <Play fill="currentColor" {...props} />;
export const PauseIcon = (props: LucideProps) => <Pause fill="currentColor" {...props} />;

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
