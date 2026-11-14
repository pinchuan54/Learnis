import { LogoMark } from '../components/icons';
import page from '../styles/page.module.css';
import styles from './CalendarPage.module.css';

const monthFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' });

/** 月历页（占位）：月历视图在 #4 中实现 */
export function CalendarPage() {
  const monthTitle = monthFormatter.format(new Date());

  return (
    <div className={page.page}>
      <header className={page.header}>
        <p className={page.eyebrow}>月历</p>
        <h1 className={page.title}>{monthTitle}</h1>
      </header>

      <section className={styles.empty}>
        <LogoMark className={styles.emptyIcon} />
        <h2 className={styles.emptyTitle}>还没有学习计划</h2>
        <p className={styles.emptyText}>创建计划后，这里会按天显示你的学习进度。</p>
      </section>
    </div>
  );
}
