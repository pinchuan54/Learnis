import { type ReactNode, useEffect, useRef } from 'react';
import styles from './Sheet.module.css';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}

/**
 * 模态面板（基于原生 <dialog>）：自带焦点管理，Esc 或点击遮罩关闭。
 * 关闭时卸载内容，下次打开是全新状态。
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      style={{ width }}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={styles.content}>
          <header className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            {description && <p className={styles.description}>{description}</p>}
          </header>
          {children && <div className={styles.body}>{children}</div>}
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
