import { useState } from 'react';
import { useCreateTodo, useDeleteTodo, useUpdateTodo } from '../../api/hooks';
import type { PlanSummary, Todo } from '../../api/types';
import { CheckIcon, TrashIcon } from '../../components/icons';
import { Button } from '../../components/ui/Button';
import forms from '../../components/ui/forms.module.css';
import { useToast } from '../../components/ui/toast/ToastContext';
import { planColorVar } from '../../lib/planColors';
import blocks from '../../styles/blocks.module.css';
import styles from './TodoSection.module.css';

/** 当天待办：添加、勾选、删除，可关联计划 */
export function TodoSection({
  date,
  todos,
  plans,
}: {
  date: string;
  todos: Todo[];
  plans: PlanSummary[];
}) {
  const [title, setTitle] = useState('');
  const [planId, setPlanId] = useState<number | null>(null);
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const toast = useToast();
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  const add = () => {
    if (title.trim() === '') return;
    createTodo.mutate(
      { date, title, planId },
      { onSuccess: () => setTitle(''), onError: toast.error },
    );
  };

  return (
    <div className={styles.wrapper}>
      {todos.length > 0 && (
        <ul className={blocks.list}>
          {todos.map((todo) => {
            const plan = todo.planId !== null ? planById.get(todo.planId) : undefined;
            return (
              <li key={todo.id} className={`${blocks.row} ${styles.row}`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={todo.done}
                  aria-label={todo.done ? '标记为未完成' : '标记为完成'}
                  className={todo.done ? `${styles.check} ${styles.checked}` : styles.check}
                  onClick={() =>
                    updateTodo.mutate(
                      { id: todo.id, patch: { done: !todo.done } },
                      { onError: toast.error },
                    )
                  }
                >
                  {todo.done && <CheckIcon />}
                </button>
                <div className={blocks.rowMain}>
                  <span className={todo.done ? `${styles.title} ${styles.done}` : styles.title}>
                    {todo.title}
                  </span>
                  {plan && (
                    <span className={styles.plan}>
                      <span
                        className={blocks.dot}
                        style={{ background: planColorVar(plan.color) }}
                      />
                      {plan.name}
                    </span>
                  )}
                </div>
                <Button
                  iconOnly
                  size="sm"
                  variant="plain"
                  className={styles.delete}
                  aria-label="删除待办"
                  onClick={() => deleteTodo.mutate(todo.id, { onError: toast.error })}
                >
                  <TrashIcon />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className={styles.add}
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          className={forms.input}
          value={title}
          maxLength={100}
          placeholder="添加待办，例如「看完表达式教程第 3 章」"
          aria-label="新待办"
          onChange={(event) => setTitle(event.target.value)}
        />
        <select
          className={`${forms.select} ${styles.planSelect}`}
          value={planId ?? ''}
          aria-label="关联计划"
          onChange={(event) =>
            setPlanId(event.target.value === '' ? null : Number(event.target.value))
          }
        >
          <option value="">不关联计划</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          variant="primary"
          disabled={title.trim() === '' || createTodo.isPending}
        >
          添加
        </Button>
      </form>
    </div>
  );
}
