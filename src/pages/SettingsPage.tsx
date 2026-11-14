import { type ReactNode, useEffect, useState } from 'react';
import { useClock, useSettings, useTimezones, useUpdateSettings } from '../api/hooks';
import type {
  CountdownEnd,
  Settings,
  ShortfallDefault,
  TimerDisplay,
  TimerStyle,
} from '../api/types';
import { Button } from '../components/ui/Button';
import forms from '../components/ui/forms.module.css';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Switch } from '../components/ui/Switch';
import { useToast } from '../components/ui/toast/ToastContext';
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

const COMMON_TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
];

const LONG_SESSION_OPTIONS = [
  { value: 0, label: '不提醒' },
  { value: 60, label: '1 小时' },
  { value: 90, label: '1.5 小时' },
  { value: 120, label: '2 小时' },
  { value: 180, label: '3 小时' },
  { value: 240, label: '4 小时' },
];

/** 设置页 */
export function SettingsPage() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const toast = useToast();

  const save = (patch: Partial<Settings>) => updateSettings.mutate(patch, { onError: toast.error });

  return (
    <div className={page.page}>
      <header className={page.header}>
        <h1 className={page.title}>设置</h1>
        <p className={page.subtitle}>让 Learnis 按你习惯的方式工作。</p>
      </header>

      <AppearanceSection />

      {settings && (
        <>
          <Section title="计时器" text="计时页面默认的外观和行为，计时时也可以随时切换。">
            <ul className={styles.group}>
              <SettingRow title="默认外观">
                <SegmentedControl<TimerStyle>
                  ariaLabel="默认外观"
                  options={[
                    { value: 'digital', label: '电子计时器' },
                    { value: 'analog', label: '物理秒表' },
                  ]}
                  value={settings.timerStyle}
                  onChange={(timerStyle) => save({ timerStyle })}
                />
              </SettingRow>
              <SettingRow title="默认显示">
                <SegmentedControl<TimerDisplay>
                  ariaLabel="默认显示"
                  options={[
                    { value: 'countDown', label: '倒计时' },
                    { value: 'countUp', label: '正计时' },
                  ]}
                  value={settings.timerDisplay}
                  onChange={(timerDisplay) => save({ timerDisplay })}
                />
              </SettingRow>
              <SettingRow title="倒计时归零后" hint="选择继续时，超出目标的部分会用橙色标出">
                <SegmentedControl<CountdownEnd>
                  ariaLabel="倒计时归零后"
                  options={[
                    { value: 'pause', label: '自动暂停并提醒' },
                    { value: 'continue', label: '继续计时' },
                  ]}
                  value={settings.countdownEnd}
                  onChange={(countdownEnd) => save({ countdownEnd })}
                />
              </SettingRow>
              <SettingRow title="长时间计时提醒" hint="单次连续计时超过设定时长时提醒休息">
                <select
                  className={`${forms.select} ${styles.select}`}
                  value={settings.longSessionMinutes}
                  aria-label="长时间计时提醒"
                  onChange={(event) => save({ longSessionMinutes: Number(event.target.value) })}
                >
                  {LONG_SESSION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </SettingRow>
            </ul>
          </Section>

          <Section title="没学够的时长" text="一天结束后，没完成的时长默认如何处理。">
            <ul className={styles.group}>
              <SettingRow title="默认处理方式" hint="挂起时会在月历和今天页面提醒你手动安排">
                <SegmentedControl<ShortfallDefault>
                  ariaLabel="默认处理方式"
                  options={[
                    { value: 'suspend', label: '挂起等我处理' },
                    { value: 'spread', label: '自动均分' },
                    { value: 'nextDay', label: '自动加到下一天' },
                  ]}
                  value={settings.shortfallDefault}
                  onChange={(shortfallDefault) => save({ shortfallDefault })}
                />
              </SettingRow>
            </ul>
          </Section>

          <Section title="快捷键与托盘" text="在 AE 等任何软件里都能用快捷键开始或暂停计时。">
            <ul className={styles.group}>
              <SettingRow title="开始 / 暂停计时" hint="作用于最近计时的计划；点击后按下新的组合键">
                <HotkeyField
                  value={settings.toggleHotkey}
                  onSave={(toggleHotkey) => save({ toggleHotkey })}
                />
              </SettingRow>
              <SettingRow
                title="关闭窗口时缩到托盘"
                hint="关闭后计时和快捷键仍然有效，从托盘图标可以重新打开"
              >
                <Switch
                  label="关闭窗口时缩到托盘"
                  checked={settings.closeToTray}
                  onChange={(closeToTray) => save({ closeToTray })}
                />
              </SettingRow>
            </ul>
          </Section>

          <TimezoneSection
            timezone={settings.timezone}
            onChange={(timezone) => save({ timezone })}
          />
        </>
      )}

      <Section title="关于">
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
      </Section>
    </div>
  );
}

function Section({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  const id = `settings-${title}`;
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHeader}>
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
        {text && <p className={styles.sectionText}>{text}</p>}
      </div>
      {children}
    </section>
  );
}

function SettingRow({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <li className={styles.settingRow}>
      <div className={styles.settingText}>
        <span className={styles.settingTitle}>{title}</span>
        {hint && <span className={styles.settingHint}>{hint}</span>}
      </div>
      <div className={styles.control}>{children}</div>
    </li>
  );
}

function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  return (
    <Section title="外观" text="选择浅色、深色，或跟随系统自动切换。">
      <div className={styles.appearance} role="radiogroup" aria-label="外观">
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
    </Section>
  );
}

function TimezoneSection({
  timezone,
  onChange,
}: {
  timezone: string;
  onChange: (value: string) => void;
}) {
  const { data: clock } = useClock();
  const { data: zones } = useTimezones();
  const others = (zones ?? []).filter((zone) => !COMMON_TIMEZONES.includes(zone));

  return (
    <Section
      title="时区"
      text="决定「今天」是哪一天，日界线为所选时区的 0 点。系统时区和实际所在地不一致时可以在这里指定。"
    >
      <ul className={styles.group}>
        <SettingRow
          title="时区"
          hint={clock ? `当前使用 ${clock.timezone}，今天是 ${clock.today}` : undefined}
        >
          <select
            className={`${forms.select} ${styles.select} ${styles.wide}`}
            value={timezone}
            aria-label="时区"
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="system">跟随系统</option>
            <optgroup label="常用">
              {COMMON_TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </optgroup>
            <optgroup label="全部">
              {others.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </optgroup>
          </select>
        </SettingRow>
      </ul>
    </Section>
  );
}

/** 把按键事件转成全局快捷键字符串，例如 `Ctrl+Shift+F12` */
function hotkeyFromEvent(event: KeyboardEvent): string | null {
  const { code } = event;
  if (/^(Control|Shift|Alt|Meta)(Left|Right)$/.test(code)) return null;
  let key = code;
  if (code.startsWith('Key')) key = code.slice(3);
  else if (code.startsWith('Digit')) key = code.slice(5);
  const modifiers = [
    event.ctrlKey && 'Ctrl',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
    event.metaKey && 'Super',
  ].filter(Boolean) as string[];
  const isFunctionKey = /^F\d{1,2}$/.test(key);
  if (modifiers.length === 0 && !isFunctionKey) return null;
  return [...modifiers, key].join('+');
}

function HotkeyField({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const handleKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        setRecording(false);
        return;
      }
      const hotkey = hotkeyFromEvent(event);
      if (hotkey) {
        setRecording(false);
        if (hotkey !== value) onSave(hotkey);
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [recording, value, onSave]);

  return (
    <div className={styles.hotkey}>
      {recording ? (
        <span className={styles.recording}>请按下组合键…（Esc 取消）</span>
      ) : (
        <span className={styles.keys}>
          {value.split('+').map((part) => (
            <kbd key={part} className={styles.keycap}>
              {part}
            </kbd>
          ))}
        </span>
      )}
      <Button size="sm" onClick={() => setRecording((current) => !current)}>
        {recording ? '取消' : '修改'}
      </Button>
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
