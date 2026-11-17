import { type ReactNode, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import appIcon from '../../src-tauri/icons/app-icon.svg';
import { api } from '../api/client';
import {
  useAutostart,
  useClock,
  useSetAutostart,
  useSettings,
  useTimezones,
  useUpdateSettings,
} from '../api/hooks';
import type {
  Settings,
  ShortfallDefault,
  TimerDisplay,
  TimerStyle,
  UpdateInfo,
  UpdateProgress,
} from '../api/types';
import {
  ArrowUpRightIcon,
  CheckIcon,
  InfoIcon,
  PaletteIcon,
  SlidersIcon,
  StopwatchIcon,
  TargetIcon,
} from '../components/icons';
import { Button } from '../components/ui/Button';
import forms from '../components/ui/forms.module.css';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Switch } from '../components/ui/Switch';
import { useToast } from '../components/ui/toast/ToastContext';
import { describeProgress } from '../features/update/progress';
import { useUpdater } from '../features/update/useUpdater';
import type { ThemePreference } from '../lib/theme';
import { rectCenter } from '../lib/themeTransition';
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

type PageProps = { settings: Settings; save: (patch: Partial<Settings>) => void };

/** 设置分类：左侧导航的一项对应右侧一页，地址为 `/settings/<id>` */
const PAGES = [
  { id: 'general', label: '通用', Icon: SlidersIcon, Content: GeneralSettings },
  { id: 'appearance', label: '外观', Icon: PaletteIcon, Content: AppearanceSettings },
  { id: 'timer', label: '计时', Icon: StopwatchIcon, Content: TimerSettings },
  { id: 'plans', label: '计划', Icon: TargetIcon, Content: PlanSettings },
  { id: 'about', label: '关于', Icon: InfoIcon, Content: AboutSettings },
];

/** 设置页：左侧分类导航，右侧显示当前分类 */
export function SettingsPage() {
  const { section } = useParams();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const toast = useToast();
  const current = PAGES.find((item) => item.id === section) ?? PAGES[0];

  const save = (patch: Partial<Settings>) => updateSettings.mutate(patch, { onError: toast.error });

  return (
    <div className={`${page.page} ${styles.layout}`}>
      <nav className={styles.sidebar} aria-label="设置分类">
        {PAGES.map(({ id, label, Icon }) => (
          <Link
            key={id}
            to={`/settings/${id}`}
            replace
            aria-current={id === current.id ? 'page' : undefined}
            className={styles.navItem}
          >
            <Icon />
            {label}
          </Link>
        ))}
      </nav>
      <div>
        <header className={page.header}>
          <h1 className={page.title}>{current.label}</h1>
        </header>
        {settings && <current.Content settings={settings} save={save} />}
      </div>
    </div>
  );
}

function GeneralSettings(props: PageProps) {
  return (
    <>
      <StartupSection {...props} />
      <TimezoneSection {...props} />
    </>
  );
}

function AppearanceSettings({ settings, save }: PageProps) {
  const { preference, setPreference } = useTheme();
  return (
    <>
      <Section title="浅色与深色" text="选择浅色、深色，或跟随系统自动切换。">
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
                onClick={(event) =>
                  // 新外观从被点卡片的中心以圆形展开
                  setPreference(
                    option.value,
                    rectCenter(event.currentTarget.getBoundingClientRect()),
                  )
                }
              >
                <AppearanceThumbnail variant={option.value} />
                <span className={styles.optionLabel}>{option.label}</span>
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="顶部导航" text="窗口顶部导航栏的显示方式。">
        <ul className={styles.group}>
          <SettingRow title="显示应用名称" hint="关闭后左上角只显示 Learnis 的标志">
            <Switch
              label="显示应用名称"
              checked={settings.showAppName}
              onChange={(showAppName) => save({ showAppName })}
            />
          </SettingRow>
        </ul>
      </Section>
      <Section title="月历" text="月历页面的显示方式。">
        <ul className={styles.group}>
          <SettingRow
            title="显示图例"
            hint="在月历下方说明各颜色的含义：达标、多学、进行中、没学够、有调整"
          >
            <Switch
              label="显示图例"
              checked={settings.showCalendarLegend}
              onChange={(showCalendarLegend) => save({ showCalendarLegend })}
            />
          </SettingRow>
        </ul>
      </Section>
    </>
  );
}

function TimerSettings({ settings, save }: PageProps) {
  return (
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
          <SettingRow
            title="倒计时归零提醒"
            hint="今天的目标学完时提醒你，选择继续学习或暂停。计时不会自动停下，超出的部分用橙色标出"
          >
            <Switch
              label="倒计时归零提醒"
              checked={settings.countdownReminder}
              onChange={(countdownReminder) => save({ countdownReminder })}
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

      <Section title="快捷键" text="在 AE 等任何软件里都能用快捷键开始或暂停计时。">
        <ul className={styles.group}>
          <SettingRow title="开始 / 暂停计时" hint="作用于最近计时的计划；点击后按下新的组合键">
            <HotkeyField
              value={settings.toggleHotkey}
              onSave={(toggleHotkey) => save({ toggleHotkey })}
            />
          </SettingRow>
        </ul>
      </Section>
    </>
  );
}

function PlanSettings({ settings, save }: PageProps) {
  return (
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
  );
}

/** 启动与窗口：开机自启（以系统登记为准）、静默启动、关闭到托盘 */
function StartupSection({ settings, save }: PageProps) {
  const toast = useToast();
  const autostart = useAutostart();
  const setAutostart = useSetAutostart();
  // 切换过程中先显示目标状态，避免开关来回跳
  const autostartOn = setAutostart.isPending
    ? (setAutostart.variables ?? false)
    : (autostart.data ?? false);

  return (
    <Section title="启动与窗口" text="开机后自动运行，或者只在托盘里待命，随时用快捷键开始计时。">
      <ul className={styles.group}>
        <SettingRow
          title="开机自启"
          hint={autostart.isError ? '读取开机自启状态失败' : '登录系统后自动运行 Learnis'}
        >
          <Switch
            label="开机自启"
            checked={autostartOn}
            disabled={autostart.data === undefined || setAutostart.isPending}
            onChange={(enabled) => setAutostart.mutate(enabled, { onError: toast.error })}
          />
        </SettingRow>
        <SettingRow
          title="静默启动"
          hint="开机自启时不打开窗口，只在托盘运行；自己打开 Learnis 时照常显示窗口"
        >
          <Switch
            label="静默启动"
            checked={settings.silentStart}
            disabled={!autostartOn}
            onChange={(silentStart) => save({ silentStart })}
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
  );
}

function AboutSettings() {
  const toast = useToast();
  const { state, check, install } = useUpdater(toast.error);
  const busy = state.phase === 'checking' || state.phase === 'installing';

  const openProjectPage = () => {
    api.openProjectPage().catch(toast.error);
  };

  const checkUpdate = async () => {
    const info = await check();
    if (info) toast.show(`发现新版本 ${formatDisplayVersion(info.version)}`);
  };

  return (
    <ul className={styles.group}>
      <li className={`${styles.settingRow} ${styles.appRow}`}>
        <div className={styles.appInfo}>
          <img className={styles.appIcon} src={appIcon} alt="" draggable={false} />
          <div className={styles.settingText}>
            <span className={styles.appName}>Learnis</span>
            <span className={styles.settingHint}>
              版本 {formatDisplayVersion(__APP_VERSION__)}
              {__BUILD_COMMIT__ && ` · ${__BUILD_COMMIT__}`}
              {state.phase === 'latest' && (
                <span className={styles.latest}>
                  <CheckIcon />
                  已是最新版本
                </span>
              )}
            </span>
          </div>
        </div>
        <div className={styles.appActions}>
          <Button onClick={() => void checkUpdate()} disabled={busy}>
            {state.phase === 'checking' ? '正在检查…' : '检查更新'}
          </Button>
          <Button onClick={openProjectPage}>
            项目地址
            <ArrowUpRightIcon />
          </Button>
        </div>
      </li>
      {(state.phase === 'available' || state.phase === 'installing') && (
        <UpdateRow
          info={state.info}
          installing={state.phase === 'installing'}
          progress={state.phase === 'installing' ? state.progress : null}
          onInstall={() => void install(state.info)}
        />
      )}
      <SettingRow title="贡献者">
        <span className={styles.value}>pinchuan54</span>
      </SettingRow>
    </ul>
  );
}

/** 发现新版本时显示：版本号、更新说明、立即更新与下载进度 */
function UpdateRow({
  info,
  installing,
  progress,
  onInstall,
}: {
  info: UpdateInfo;
  installing: boolean;
  progress: UpdateProgress | null;
  onInstall: () => void;
}) {
  const view = describeProgress(progress);
  return (
    <li className={`${styles.settingRow} ${styles.updateRow}`}>
      <div className={styles.updateText}>
        <span className={styles.updateTitle}>
          <span className={styles.badge}>新版本</span>
          Learnis {formatDisplayVersion(info.version)}
        </span>
        <span className={styles.settingHint}>
          更新时 Learnis 会关闭并自动重新打开，正在进行的计时不受影响
        </span>
        {info.notes && <p className={styles.notes}>{info.notes}</p>}
        {installing && (
          <div className={styles.progress}>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label="下载进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={view.ratio === null ? undefined : Math.round(view.ratio * 100)}
            >
              <div
                className={view.ratio === null ? styles.progressIndeterminate : styles.progressBar}
                style={view.ratio === null ? undefined : { width: `${view.ratio * 100}%` }}
              />
            </div>
            <span className={styles.settingHint}>{view.text}</span>
          </div>
        )}
      </div>
      <div className={styles.control}>
        <Button variant="primary" onClick={onInstall} disabled={installing}>
          {installing ? '正在更新…' : '立即更新'}
        </Button>
      </div>
    </li>
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

function TimezoneSection({ settings, save }: PageProps) {
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
            value={settings.timezone}
            aria-label="时区"
            onChange={(event) => save({ timezone: event.target.value })}
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
