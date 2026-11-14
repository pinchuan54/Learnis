import { formatDisplayVersion } from '../lib/version';
import page from '../styles/page.module.css';
import styles from './SettingsPage.module.css';

/** 设置页（占位）：完整设置项在 #10 中实现 */
export function SettingsPage() {
  return (
    <div className={page.page}>
      <header className={page.header}>
        <h1 className={page.title}>设置</h1>
      </header>

      <section className={styles.group} aria-labelledby="settings-about">
        <h2 id="settings-about" className={styles.groupTitle}>
          关于
        </h2>
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt>版本</dt>
            <dd className={styles.value}>{formatDisplayVersion(__APP_VERSION__)}</dd>
          </div>
          <div className={styles.row}>
            <dt>贡献者</dt>
            <dd className={styles.value}>pinchuan54、Claude</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
