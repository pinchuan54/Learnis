import { NavLink } from 'react-router';
import { inTauri } from '../lib/platform';
import { LogoMark } from './icons';
import styles from './GlobalNav.module.css';
import { WindowControls } from './WindowControls';

const NAV_ITEMS = [
  { to: '/', label: '月历' },
  { to: '/settings', label: '设置' },
];

/**
 * 顶部导航栏，同时充当窗口标题栏。
 * 空白处可拖动窗口、双击最大化；内容滚动时从下方透出（半透明模糊）。
 */
export function GlobalNav() {
  return (
    <header className={styles.nav} data-tauri-drag-region>
      <div className={styles.brand}>
        <LogoMark className={styles.logo} />
        <span>Learnis</span>
      </div>

      <nav className={styles.links} aria-label="主导航" data-tauri-drag-region>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.trailing} data-tauri-drag-region>
        {inTauri && <WindowControls />}
      </div>
    </header>
  );
}
