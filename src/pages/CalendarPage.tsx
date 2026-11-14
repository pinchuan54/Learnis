import type { ReactNode } from 'react';
import { AdjustIcon, CalendarIcon, ProgressRing, StopwatchIcon } from '../components/icons';
import page from '../styles/page.module.css';
import styles from './CalendarPage.module.css';

const monthFormatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' });
const dayFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

interface Feature {
  icon: ReactNode;
  title: string;
  text: string;
}

const FEATURES: Feature[] = [
  {
    icon: <CalendarIcon />,
    title: '按天分配',
    text: '设定总时长和期限，自动分到期限内的每个学习日。',
  },
  {
    icon: <StopwatchIcon />,
    title: '专注计时',
    text: '正计时、倒计时随时切换，超出目标的时长单独记录。',
  },
  {
    icon: <AdjustIcon />,
    title: '灵活调整',
    text: '今天没学够？均分到后面、拆到指定日子，或全部顺延。',
  },
];

/** 月历页（空状态）：月历视图在 #4 中实现 */
export function CalendarPage() {
  const now = new Date();

  return (
    <div className={page.page}>
      <header className={page.header}>
        <p className={page.eyebrow}>月历</p>
        <h1 className={page.title}>{monthFormatter.format(now)}</h1>
        <p className={page.subtitle}>今天是{dayFormatter.format(now)}</p>
      </header>

      <section className={styles.hero} aria-labelledby="calendar-empty-title">
        <ProgressRing progress={0.68} className={styles.ring} />
        <h2 id="calendar-empty-title" className={styles.heroTitle}>
          还没有学习计划
        </h2>
        <p className={styles.heroText}>
          设定一个总时长和期限，Learnis 会把它分配到每一天，
          <br />
          你只需要按下计时器。
        </p>
      </section>

      <ul className={styles.features}>
        {FEATURES.map((feature) => (
          <li key={feature.title} className={styles.feature}>
            <span className={styles.featureIcon}>{feature.icon}</span>
            <h3 className={styles.featureTitle}>{feature.title}</h3>
            <p className={styles.featureText}>{feature.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
