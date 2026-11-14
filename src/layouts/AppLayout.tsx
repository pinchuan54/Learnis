import { Outlet } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { TitleBar } from '../components/TitleBar';
import styles from './AppLayout.module.css';

/** 应用外壳：顶部标题栏 + 左侧导航 + 右侧内容区 */
export function AppLayout() {
  return (
    <div className={styles.shell}>
      <TitleBar />
      <Sidebar />
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
