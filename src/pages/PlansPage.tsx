import { useState } from 'react';
import { useClock, useDeletePlan, usePlans, useSetPlanArchived } from '../api/hooks';
import type { PlanSummary } from '../api/types';
import { PlusIcon } from '../components/icons';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import { useToast } from '../components/ui/toast/ToastContext';
import { PlanCard } from '../features/plans/PlanCard';
import { PlanSheet } from '../features/plans/PlanSheet';
import blocks from '../styles/blocks.module.css';
import page from '../styles/page.module.css';
import styles from './PlansPage.module.css';

/** 计划页：查看、新建、编辑、归档、删除计划 */
export function PlansPage() {
  const { data: plans, isLoading, error } = usePlans(true);
  const { data: clock } = useClock();
  const setArchived = useSetPlanArchived();
  const deletePlan = useDeletePlan();
  const toast = useToast();
  const [editing, setEditing] = useState<PlanSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PlanSummary | null>(null);

  const active = plans?.filter((plan) => !plan.archived) ?? [];
  const archived = plans?.filter((plan) => plan.archived) ?? [];

  const renderCard = (plan: PlanSummary) => (
    <PlanCard
      key={plan.id}
      plan={plan}
      today={clock?.today}
      onEdit={() => setEditing(plan)}
      onDelete={() => setDeleting(plan)}
      onToggleArchive={() =>
        setArchived.mutate(
          { id: plan.id, archived: !plan.archived },
          {
            onSuccess: () =>
              toast.show(plan.archived ? '已恢复计划' : '已归档，不再分配新的每日目标'),
            onError: toast.error,
          },
        )
      }
    />
  );

  return (
    <div className={page.page}>
      <header className={`${page.header} ${page.headerWithActions}`}>
        <div className={page.headerText}>
          <h1 className={page.title}>计划</h1>
          <p className={page.subtitle}>每个计划都是一个总时长和一个期限。</p>
        </div>
        <div className={page.headerActions}>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <PlusIcon />
            新建计划
          </Button>
        </div>
      </header>

      {error && <p className={blocks.errorText}>{error.message}</p>}

      {!isLoading && active.length === 0 && (
        <section className={blocks.empty}>
          <h2 className={blocks.emptyTitle}>还没有进行中的计划</h2>
          <p>比如「AE，1000 小时，明年 6 月前」，创建后会自动分配到每一天。</p>
          <Button
            variant="primary"
            size="lg"
            className={styles.emptyButton}
            onClick={() => setCreating(true)}
          >
            新建计划
          </Button>
        </section>
      )}

      {active.length > 0 && <div className={styles.grid}>{active.map(renderCard)}</div>}

      {archived.length > 0 && (
        <section className={styles.archived}>
          <div className={blocks.sectionHeader}>
            <h2 className={blocks.sectionTitle}>已归档</h2>
            <span className={blocks.sectionNote}>保留学习记录，不再产生新的每日目标</span>
          </div>
          <div className={styles.grid}>{archived.map(renderCard)}</div>
        </section>
      )}

      <PlanSheet open={creating} onClose={() => setCreating(false)} />
      <PlanSheet open={editing !== null} plan={editing} onClose={() => setEditing(null)} />

      <Sheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`删除「${deleting?.name ?? ''}」？`}
        description="计划的每日分配、调整和全部学习记录都会被删除，无法恢复。只想停止的话可以选择归档。"
        width={440}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>取消</Button>
            <Button
              variant="primary"
              className={styles.dangerButton}
              disabled={deletePlan.isPending}
              onClick={() => {
                if (!deleting) return;
                deletePlan.mutate(deleting.id, {
                  onSuccess: () => {
                    toast.show('计划已删除');
                    setDeleting(null);
                  },
                  onError: toast.error,
                });
              }}
            >
              删除
            </Button>
          </>
        }
      />
    </div>
  );
}
