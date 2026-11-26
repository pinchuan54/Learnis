import { Link, useLocation } from 'react-router';
import { api } from '../api/client';
import { usePlans, useSettings, useTimerStatus } from '../api/hooks';
import { useFloatOpen } from '../features/float/useFloatOpen';
import { useLiveLearned } from '../features/timer/liveLearned';
import { useNow } from '../hooks/useNow';
import { formatClock } from '../lib/format';
import { planColorVar } from '../lib/planColors';
import { inTauri } from '../lib/platform';
import {
  CalendarIcon,
  FloatIcon,
  LogoMark,
  SettingsIcon,
  StopwatchIcon,
  TargetIcon,
} from './icons';
import styles from './GlobalNav.module.css';
import { WindowControls } from './WindowControls';

const NAV_ITEMS = [
  { to: '/today', label: '今天', Icon: StopwatchIcon, match: (path: string) => path === '/today' },
  {
    to: '/',
    label: '月历',
    Icon: CalendarIcon,
    match: (path: string) => path === '/' || path.startsWith('/day/'),
  },
  {
    to: '/plans',
    label: '计划',
    Icon: TargetIcon,
    match: (path: string) => path.startsWith('/plans'),
  },
  {
    to: '/settings',
    label: '设置',
    Icon: SettingsIcon,
    match: (path: string) => path.startsWith('/settings'),
  },
];

/**
 * 顶部导航栏，同时充当窗口标题栏。
 * 空白处可拖动窗口、双击最大化；内容滚动时从下方透出（半透明模糊）。
 */
export function GlobalNav() {
  const { pathname } = useLocation();
  const { data: settings } = useSettings();
  const floatOpen = useFloatOpen();

  return (
    <header className={styles.nav} data-tauri-drag-region>
      <div className={styles.brand}>
        <LogoMark className={styles.logo} />
        {/* 设置读出来后才渲染：启动时直接是最终状态，只有在设置页切换时才播收起 / 展开 */}
        {settings && (
          <span className={styles.name} aria-hidden={!settings.showAppName}>
            Learnis
          </span>
        )}
      </div>

      <nav className={styles.links} aria-label="主导航" data-tauri-drag-region>
        {NAV_ITEMS.map(({ to, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={active ? `${styles.link} ${styles.active}` : styles.link}
              // 鼠标移开就交还焦点，下次停上来照常提示
              onMouseLeave={(event) => event.currentTarget.blur()}
            >
              <Icon />
            </Link>
          );
        })}
      </nav>

      <div className={styles.trailing} data-tauri-drag-region>
        <TimerPill />
        {inTauri && (
          // 悬浮窗的开关，开着时高亮；和主窗口可以同时出现
          <button
            type="button"
            className={`${styles.link} ${styles.floatButton} ${floatOpen ? styles.active : ''}`}
            aria-label="悬浮窗"
            aria-pressed={floatOpen}
            onClick={() => void api.toggleFloat()}
            onMouseLeave={(event) => event.currentTarget.blur()}
          >
            <FloatIcon />
          </button>
        )}
        {inTauri && <WindowControls />}
      </div>
    </header>
  );
}

/** 正在计时时显示的小胶囊，点击回到「今天」 */
function TimerPill() {
  const { data: status } = useTimerStatus();
  const { data: plans } = usePlans(true);
  const running = status?.running ?? null;
  const now = useNow(1000, running !== null);
  const live = useLiveLearned();

  if (!status || !running || !status.planToday) return null;
  const plan = plans?.find((item) => item.id === running.planId);
  // 计时器表正显示这个计划时跟着表走（拖动调整时实时变化），否则按服务端数据推算
  const studied =
    live?.planId === running.planId
      ? live.seconds
      : status.planToday.studiedSeconds + Math.max(0, (now - status.nowMs) / 1000);

  return (
    <Link to="/today" className={styles.pill} title="正在计时，点击查看">
      <span className={styles.pulse} style={{ background: planColorVar(plan?.color ?? 'blue') }} />
      <span className={styles.pillName}>{plan?.name ?? '计时中'}</span>
      <span className={styles.pillTime}>{formatClock(studied)}</span>
    </Link>
  );
}
