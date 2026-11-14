import type { ThemePreference } from '../lib/theme';
import { formatDisplayVersion } from '../lib/version';
import page from '../styles/page.module.css';
import { useTheme } from '../theme/ThemeContext';
import styles from './SettingsPage.module.css';

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
];

/** 设置页：外观与关于，其余设置项在 #10 中补充 */
export function SettingsPage() {
  const { preference, setPreference } = useTheme();

  return (
    <div className={page.page}>
      <header className={page.header}>
        <h1 className={page.title}>设置</h1>
        <p className={page.subtitle}>让 Learnis 按你习惯的方式工作。</p>
      </header>

      <section className={styles.section} aria-labelledby="settings-appearance">
        <div className={styles.sectionHeader}>
          <h2 id="settings-appearance" className={styles.sectionTitle}>
            外观
          </h2>
          <p className={styles.sectionText}>选择浅色、深色，或跟随系统自动切换。</p>
        </div>

        <div className={styles.appearance} role="radiogroup" aria-labelledby="settings-appearance">
          {APPEARANCE_OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.label}
                className={selected ? `${styles.option} ${styles.selected}` : styles.option}
                onClick={() => setPreference(option.value)}
              >
                <AppearanceThumbnail variant={option.value} />
                <span className={styles.optionLabel}>{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="settings-about">
        <div className={styles.sectionHeader}>
          <h2 id="settings-about" className={styles.sectionTitle}>
            关于
          </h2>
        </div>
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

/** 外观选项的缩略图：一个迷你窗口，「跟随系统」左浅右深 */
function AppearanceThumbnail({ variant }: { variant: ThemePreference }) {
  const panes = variant === 'system' ? (['light', 'dark'] as const) : [variant];
  return (
    <span className={styles.thumbnail} aria-hidden="true">
      {panes.map((pane) => (
        <span key={pane} className={`${styles.pane} ${styles[pane]}`}>
          <span className={styles.miniNav} />
          <span className={styles.miniTitle} />
          <span className={styles.miniCard} />
        </span>
      ))}
    </span>
  );
}
