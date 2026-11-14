import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext, type ToastApi, type ToastTone } from './ToastContext';
import styles from './Toast.module.css';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const DURATION_MS = 3200;

/** 屏幕底部的轻提示 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, DURATION_MS);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (error: unknown) =>
        show(error instanceof Error ? error.message : String(error), 'error'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`${styles.toast} ${styles[item.tone]}`}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
