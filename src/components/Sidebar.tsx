import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { formatDisplayVersion } from '../lib/version';
import { CalendarIcon, GearIcon } from './icons';
import styles from './Sidebar.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '月历', icon: <CalendarIcon /> },
  { to: '/settings', label: '设置', icon: <GearIcon /> },
];

export function Sidebar() {
  return (
    <nav className={styles.sidebar} aria-label="主导航">
      <ul className={styles.list}>
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end
              className={({ isActive }) =>
                isActive ? `${styles.item} ${styles.active}` : styles.item
              }
            >
              <span className={styles.icon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <p className={styles.version}>{formatDisplayVersion(__APP_VERSION__)}</p>
    </nav>
  );
}
