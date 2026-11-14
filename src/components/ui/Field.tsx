import type { ReactNode } from 'react';
import forms from './forms.module.css';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  /** 子元素本身不是单个输入框（如一组按钮）时用 div，避免 label 嵌套交互元素 */
  as?: 'label' | 'div';
}

export function Field({ label, hint, error, children, as = 'label' }: FieldProps) {
  const Tag = as;
  return (
    <Tag className={forms.field}>
      <span className={forms.label}>{label}</span>
      {children}
      {error ? (
        <span className={forms.error}>{error}</span>
      ) : (
        hint && <span className={forms.hint}>{hint}</span>
      )}
    </Tag>
  );
}
