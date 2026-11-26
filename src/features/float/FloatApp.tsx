import { emitTo } from '@tauri-apps/api/event';
import type { Theme } from '@tauri-apps/api/window';
import { useQueryClient } from '@tanstack/react-query';
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { api } from '../../api/client';
import {
  queryKeys,
  usePlans,
  useSettings,
  useStartTimer,
  useStopTimer,
  useTimerStatus,
  useUpdateSettings,
} from '../../api/hooks';
import type { Plan, Settings, TimerStatus } from '../../api/types';
import { useBackendSync } from '../../api/useBackendSync';
import { useNow } from '../../hooks/useNow';
import { planColorVar } from '../../lib/planColors';
import { showFloatMenu } from './floatMenu';
import { GROWTH, resizeRatio } from './geometry';
import { DialTicks, FlipCard, PlayPause, Rolling } from './parts';
import { arcStyle, formatClock, liquidShift, pad2, reading, timeline } from './timeline';
import { useFlowSync } from './useFlowSync';
import { usePlacement } from './usePlacement';
import { useSystemTheme } from './useSystemTheme';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SPRING = 'cubic-bezier(0.32, 1.28, 0.5, 1)';

/** 大小按 5% 一档，限制在 80% ~ 200% */
const clampScale = (value: number) => Math.round(Math.min(200, Math.max(80, value)) / 5) * 5;

/** 悬浮窗页面：设置、计时状态、计划、系统深浅色都读到后才渲染，第一次出现就是最终的样子 */
export function FloatApp() {
  useBackendSync();
  const { data: settings } = useSettings();
  const { data: status } = useTimerStatus();
  const { data: plans } = usePlans(true);
  const systemTheme = useSystemTheme();
  if (!settings || !status || !plans || !systemTheme) return null;
  return (
    <FloatWidget settings={settings} status={status} plans={plans} systemTheme={systemTheme} />
  );
}

interface WidgetProps {
  settings: Settings;
  status: TimerStatus;
  plans: Plan[];
  systemTheme: Theme;
}

function FloatWidget({ settings, status, plans, systemTheme }: WidgetProps) {
  const queryClient = useQueryClient();
  const updateSettings = useUpdateSettings();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  // 点按钮后界面立刻切到新状态，不等后台返回
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const serverRunning = Boolean(status.running);
  const running = optimistic ?? serverRunning;
  const now = useNow(1000, serverRunning);

  // 不在计时时，planToday 是最近使用的计划：显示它，点开始也开始它
  const progress = status.planToday;
  const plan = plans.find((item) => item.id === progress?.planId);
  const base = {
    seconds: progress?.studiedSeconds ?? 0,
    at: status.nowMs,
    running: serverRunning,
  };
  const studied = Math.floor(
    base.seconds + (serverRunning ? Math.max(0, (now - base.at) / 1000) : 0),
  );
  const target = (progress?.targetMinutes ?? 0) * 60;
  const mode = settings.timerDisplay === 'countUp' ? 'up' : 'down';
  const shown = reading(studied, target, mode);
  const line = timeline(studied, target, mode);
  // 正计时、超出部分数字变大往上滚；倒计时变小往下滚
  const dir = mode === 'down' && !shown.over ? -1 : 1;
  const sign = shown.over ? '+' : '';

  const form = settings.floatForm;
  const pinned = settings.floatPinButton && form !== 'dial';
  const [preview, setPreview] = useState<number | null>(null);
  const scale = preview ?? settings.floatScale;
  const growth = pinned ? 0 : GROWTH[form] * (scale / 100);

  // 悬停意图：鼠标停 0.12 秒才展开，单纯掠过不触发；离开展开后的范围（含拖角）才收回
  const [open, setOpen] = useState(false);
  const openTimer = useRef(0);
  const enter = () => {
    openTimer.current = window.setTimeout(() => setOpen(true), 120);
  };
  const leave = () => {
    window.clearTimeout(openTimer.current);
    setOpen(false);
  };

  // 出现动画：先停在起点（缩小、透明），窗口显示出来再播，不会先露出一帧完整的
  const appear = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const animation = content.current?.animate(
      [
        { transform: 'scale(0.6)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 380, easing: SPRING },
    );
    animation?.pause();
    appear.current = animation ?? null;
    return () => animation?.cancel();
  }, []);
  const onShown = () => {
    // 等窗口真正画出来再播
    requestAnimationFrame(() => requestAnimationFrame(() => appear.current?.play()));
  };
  const { placement, dragging, onPointerDown } = usePlacement(content, {
    growth,
    scale,
    open,
    locked: settings.floatLocked,
    onShown,
  });

  useFlowSync(root, `${form}/${settings.floatFlow}/${mode}`, base, running);

  // 秒脉搏：每走一秒，极简的圆点、小圆表的整圈轻轻跳一下
  const pulse = running && settings.floatFlow === 'pulse';
  useEffect(() => {
    if (!pulse) return;
    const el = root.current?.querySelector(form === 'dial' ? '.c-ring' : '.btn-b');
    el?.animate([{ scale: form === 'dial' ? '1.07' : '1.8' }, { scale: '1' }], {
      duration: 520,
      easing: EASE,
    });
  }, [pulse, form, studied]);

  // 配色和 Learnis 的外观无关：白、黑，或跟随系统；计划颜色按配色取浅色 / 深色那套
  const skin = settings.floatSkin === 'system' ? systemTheme : settings.floatSkin;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = skin;
  }, [skin]);

  const save = (patch: Partial<Settings>) => {
    // 先改本地缓存，悬浮窗马上变，不等后台返回
    queryClient.setQueryData<Settings>(queryKeys.settings, (old) => old && { ...old, ...patch });
    updateSettings.mutate(patch);
  };

  // 在悬浮窗上按住 Ctrl 滚动滚轮调大小（每次渲染重新挂，拿到的总是当前大小）
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      save({ floatScale: clampScale(scale - Math.sign(event.deltaY) * 5) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // 拖角：在贴边方向的对角，按住往外拉按比例缩放，贴着的边不动；松手保存
  const resize = useRef<{ sx: number; sy: number; s0: number; box: DOMRect } | null>(null);
  const onGripDown = (event: PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = content.current!.getBoundingClientRect();
    resize.current = { sx: event.screenX, sy: event.screenY, s0: scale, box };
  };
  const onGripMove = (event: PointerEvent<HTMLSpanElement>) => {
    const r = resize.current;
    if (!r) return;
    const ratio = resizeRatio(event.screenX - r.sx, event.screenY - r.sy, r.box, placement);
    setPreview(clampScale(r.s0 * ratio));
  };
  const onGripUp = () => {
    if (resize.current && preview !== null) save({ floatScale: preview });
    resize.current = null;
    setPreview(null);
  };

  const toggle = () => {
    // 还没有任何计划：回主窗口去建
    if (!progress) {
      void api.openMainWindow();
      return;
    }
    setOptimistic(!running);
    const done = { onSettled: () => setOptimistic(null) };
    if (running) stopTimer.mutate(undefined, done);
    else startTimer.mutate(progress.planId, done);
  };

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    void showFloatMenu(settings, {
      save,
      openMain: () => void api.openMainWindow(),
      hide: () => void api.closeFloat(),
      openSettings: () => {
        void api.openMainWindow().then(() => emitTo('main', 'navigate', '/settings/float'));
      },
    });
  };

  // 双击按钮以外的地方回到主窗口（悬浮窗照旧开着）
  const onDoubleClick = (event: MouseEvent) => {
    if (!(event.target as Element).closest('.tg, .grip')) void api.openMainWindow();
  };

  const classes = [
    'float',
    // 「时间在走」的动画挂在 flowing 上；由 useFlowSync 按秒数重新开始，这里一直带着，重新渲染不会丢
    'flowing',
    running && 'running',
    shown.over && 'over',
    line.extra && 'extra',
    line.drain && 'drain',
    mode === 'down' && 'down',
    open && 'open',
    pinned && 'pin',
    !settings.floatProgress && 'no-day',
    settings.floatFlipProgress && 'd-day-on',
    settings.floatDim && 'dim',
    settings.floatLocked && 'locked',
    settings.floatGrip && 'has-grip',
    dragging && 'dragging',
    preview !== null && 'resizing',
  ];
  const label = running ? '暂停计时' : '开始计时';
  const shift = liquidShift(line.p, line.drain);
  const toggleButton = (className: string) => (
    <button type="button" className={`tg ${className}`} aria-label={label} onClick={toggle}>
      <PlayPause />
    </button>
  );
  const h = Math.floor(shown.seconds / 3600);

  return (
    <div
      ref={root}
      className={classes.filter(Boolean).join(' ')}
      data-form={form}
      data-flow={settings.floatFlow}
      data-skin={skin}
      data-ax={placement.ax ?? 'center'}
      data-ay={placement.ay ?? 'center'}
      style={{ '--plan': planColorVar(plan?.color ?? 'blue') } as CSSProperties}
      onContextMenu={onContextMenu}
    >
      <div ref={content} className="fa">
        <div
          className="fz"
          style={{ zoom: scale / 100 }}
          onPointerEnter={enter}
          onPointerLeave={leave}
        >
          <div
            className={`w w-${form === 'minimal' ? 'b' : form === 'flip' ? 'd' : 'c'}`}
            onPointerDown={onPointerDown}
            onDoubleClick={onDoubleClick}
          >
            {form === 'minimal' && (
              <>
                <span className="flow" aria-hidden="true">
                  <span className="tide" style={{ transform: shift }}>
                    <span className="sheen" />
                  </span>
                  <span className="ruler-win">
                    <span className="ruler" />
                    <span className="head" />
                  </span>
                  <span className="mtrack">
                    <span className="mline" />
                  </span>
                </span>
                {toggleButton('btn-b')}
                <Rolling className="w-time" text={sign + formatClock(shown.seconds)} dir={dir} />
              </>
            )}
            {form === 'flip' && (
              <>
                <span className="d-bar" aria-hidden="true">
                  <span className="d-day" style={{ transform: shift }} />
                </span>
                {toggleButton('btn-d')}
                <FlipCard text={String(h)} reverse={mode === 'down'} hidden={h === 0} />
                <FlipCard
                  text={pad2(Math.floor((shown.seconds % 3600) / 60))}
                  reverse={mode === 'down'}
                />
                <FlipCard text={pad2(shown.seconds % 60)} reverse={mode === 'down'} />
              </>
            )}
            {form === 'dial' && (
              <>
                <svg className="c-ring" viewBox="0 0 56 56" aria-hidden="true">
                  <circle className="track" cx="28" cy="28" r="24" />
                  <circle
                    className="arc"
                    cx="28"
                    cy="28"
                    r="24"
                    pathLength={100}
                    style={arcStyle(line.p, line.drain)}
                  />
                  <circle className="mring" cx="28" cy="28" r="19.6" />
                  <circle className="marc" cx="28" cy="28" r="19.6" pathLength={100} />
                  <DialTicks />
                  <line className="marker" x1="44.6" y1="28" x2="49.6" y2="28" />
                  <g className="orbit" style={{ transform: `rotate(${studied * 6}deg)` }}>
                    <circle className="sec" cx="52" cy="28" r="2.2" />
                  </g>
                </svg>
                <span className="c-face">
                  <Rolling
                    className="w-time c-time"
                    text={sign + formatClock(shown.seconds, true)}
                    dir={dir}
                  />
                  <Rolling className="w-time c-sec" text={pad2(shown.seconds % 60)} dir={dir} />
                </span>
                {toggleButton('btn-c')}
              </>
            )}
            <span
              className="grip"
              aria-hidden="true"
              onPointerDown={onGripDown}
              onPointerMove={onGripMove}
              onPointerUp={onGripUp}
              onPointerCancel={onGripUp}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
