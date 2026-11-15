import { Outlet } from 'react-router';
import { useBackendSync } from '../api/useBackendSync';
import { GlobalNav } from '../components/GlobalNav';
import { CountdownReminderSheet } from '../features/timer/CountdownReminderSheet';
import styles from './AppLayout.module.css';

/** 应用外壳：顶部导航栏 + 滚动内容区（内容从导航栏下方透出） */
export function AppLayout() {
  useBackendSync();

  return (
    <div className={styles.shell}>
      <GlobalNav />
      <main>
        <Outlet />
      </main>
      <CountdownReminderSheet />
    </div>
  );
}
