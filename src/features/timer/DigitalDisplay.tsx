import { formatClock } from '../../lib/format';
import type { Readout } from './readout';
import styles from './DigitalDisplay.module.css';

/** 电子计时器：等宽大数字 */
export function DigitalDisplay({ readout }: { readout: Readout }) {
  const overtimeDigits = readout.overtime && readout.mode === 'countDown';
  return (
    <div className={readout.overtime ? `${styles.display} ${styles.overtime}` : styles.display}>
      <span className={styles.label}>{readout.label}</span>
      <span className={styles.digits} aria-live="off">
        {overtimeDigits && <span className={styles.plus}>+</span>}
        {formatClock(readout.seconds)}
      </span>
    </div>
  );
}
