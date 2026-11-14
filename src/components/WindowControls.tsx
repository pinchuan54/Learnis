import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';
import { CloseGlyph, MaximizeGlyph, MinimizeGlyph, RestoreGlyph } from './icons';
import styles from './WindowControls.module.css';

/** Windows 窗口按钮：最小化、最大化 / 向下还原、关闭 */
export function WindowControls() {
  const maximized = useWindowMaximized();
  const maximizeLabel = maximized ? '向下还原' : '最大化';

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.control}
        aria-label="最小化"
        title="最小化"
        onClick={() => void getCurrentWindow().minimize()}
      >
        <MinimizeGlyph className={styles.glyph} />
      </button>
      <button
        type="button"
        className={styles.control}
        aria-label={maximizeLabel}
        title={maximizeLabel}
        onClick={() => void getCurrentWindow().toggleMaximize()}
      >
        {maximized ? (
          <RestoreGlyph className={styles.glyph} />
        ) : (
          <MaximizeGlyph className={styles.glyph} />
        )}
      </button>
      <button
        type="button"
        className={`${styles.control} ${styles.close}`}
        aria-label="关闭"
        title="关闭"
        onClick={() => void getCurrentWindow().close()}
      >
        <CloseGlyph className={styles.glyph} />
      </button>
    </div>
  );
}

/** 跟踪窗口是否处于最大化状态，用于切换「最大化 / 向下还原」按钮 */
function useWindowMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const sync = () => {
      appWindow
        .isMaximized()
        .then((value) => {
          if (!disposed) setMaximized(value);
        })
        .catch(() => {});
    };

    sync();
    appWindow
      .onResized(sync)
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return maximized;
}
