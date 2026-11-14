import forms from './forms.module.css';

interface DurationInputProps {
  /** 总分钟数 */
  minutes: number;
  onChange: (minutes: number) => void;
  /** 小时数上限 */
  maxHours?: number;
  ariaLabel: string;
}

/** 「x 小时 y 分钟」输入 */
export function DurationInput({
  minutes,
  onChange,
  maxHours = 9999,
  ariaLabel,
}: DurationInputProps) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const clamp = (value: number, max: number) =>
    Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 0), max) : 0;

  return (
    <div className={forms.duration} role="group" aria-label={ariaLabel}>
      <input
        className={forms.input}
        type="number"
        inputMode="numeric"
        min={0}
        max={maxHours}
        value={hours}
        aria-label={`${ariaLabel}（小时）`}
        onChange={(event) => onChange(clamp(Number(event.target.value), maxHours) * 60 + rest)}
      />
      <span className={forms.unit}>小时</span>
      <input
        className={forms.input}
        type="number"
        inputMode="numeric"
        min={0}
        max={59}
        value={rest}
        aria-label={`${ariaLabel}（分钟）`}
        onChange={(event) => onChange(hours * 60 + clamp(Number(event.target.value), 59))}
      />
      <span className={forms.unit}>分钟</span>
    </div>
  );
}
