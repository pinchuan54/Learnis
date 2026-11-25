import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useBackendSync } from '../api/useBackendSync';
import { GlobalNav } from '../components/GlobalNav';
import { CountdownReminderCard } from '../features/timer/CountdownReminderCard';
import { inTauri } from '../lib/platform';
import styles from './AppLayout.module.css';

/** 应用外壳：顶部导航栏 + 滚动内容区（内容从导航栏下方透出） */
export function AppLayout() {
  useBackendSync();

  // 悬浮窗右键「悬浮窗设置…」：回到主窗口后跳到对应页面
  const navigate = useNavigate();
  useEffect(() => {
    if (!inTauri) return;
    const unlisten = getCurrentWindow().listen<string>('navigate', ({ payload }) => {
      void navigate(payload);
    });
    return () => void unlisten.then((stop) => stop());
  }, [navigate]);

  return (
    <div className={styles.shell}>
      <GlobalNav />
      <main>
        <Outlet />
      </main>
      <CountdownReminderCard />
    </div>
  );
}
