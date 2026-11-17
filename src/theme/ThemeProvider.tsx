import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { inTauri } from '../lib/platform';
import {
  type ResolvedTheme,
  type ThemePreference,
  THEME_STORAGE_KEY,
  parseThemePreference,
  resolveTheme,
} from '../lib/theme';
import {
  type Point,
  chooseThemeTransition,
  revealClipPath,
  revealRadius,
} from '../lib/themeTransition';
import { ThemeContext, type ThemeContextValue } from './ThemeContext';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** 圆形展开的时长和缓出曲线（与原型一致） */
const REVEAL_DURATION_MS = 700;
const REVEAL_EASING = 'cubic-bezier(0.22, 0.8, 0.2, 1)';
/** 上一段圆形展开最多等这么久，超时就直接开始下一次切换 */
const REVEAL_WAIT_LIMIT_MS = REVEAL_DURATION_MS + 300;

/** 颜色渐变：时长写在 global.css 的 html.theme-fade 里（0.45 秒），这里稍多留一点再移除 */
const FADE_CLASS = 'theme-fade';
const FADE_CLEANUP_MS = 500;

// 外观是本机界面偏好，且需在页面渲染前读取（见 public/theme-init.js），
// 因此保存在 WebView 本地存储，而不是 SQLite 设置表
function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function storePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // 存储不可用时只在本次运行中生效
  }
}

/** 原生窗口主题：手动选择时固定，跟随系统时交还给系统 */
function syncNativeTheme(preference: ThemePreference): void {
  if (!inTauri) {
    return;
  }
  getCurrentWindow()
    .setTheme(preference === 'system' ? null : preference)
    .catch(() => {});
}

/**
 * 切到「跟随系统」前，先弄清系统现在是深色还是浅色。
 * Tauri 会让 WebView 的 prefers-color-scheme 跟着原生窗口主题走：手动选过浅色 / 深色后，
 * 页面读到的是手动选的那个，而不是系统的。所以先把窗口主题交还系统，再问窗口现在是什么外观
 * （两个命令按顺序进同一个事件循环，读到的是交还之后的结果）。
 */
async function readSystemPrefersDark(): Promise<boolean> {
  if (inTauri) {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.setTheme(null);
      return (await appWindow.theme()) === 'dark';
    } catch {
      // 读不到时退回页面自己的判断
    }
  }
  return window.matchMedia(DARK_QUERY).matches;
}

/** 管理浅色 / 深色 / 跟随系统，并同步到页面和原生窗口 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  );
  const resolved = resolveTheme(preference, systemPrefersDark);

  // 回调里要读到最新的外观，又不想随渲染重建监听，所以另存一份
  const preferenceRef = useRef(preference);
  const resolvedRef = useRef(resolved);
  // 每点一次外观卡片加一；等系统外观或等上一段动画时，用它丢掉已被新点击取代的切换
  const requestRef = useRef(0);
  // 正在播放的圆形展开
  const revealRef = useRef<ViewTransition | null>(null);
  const fadeTimerRef = useRef<number | undefined>(undefined);

  // 在绘制前切换页面外观。flushSync 会同步完成提交并执行 layout effect，
  // 所以在视图过渡的回调里调用时，回调返回前 data-theme 就已经换好
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
    preferenceRef.current = preference;
    resolvedRef.current = resolved;
  }, [preference, resolved]);

  useEffect(() => {
    syncNativeTheme(preference);
  }, [preference]);

  useEffect(() => {
    return () => window.clearTimeout(fadeTimerRef.current);
  }, []);

  /**
   * 把页面切到外观 to。apply 必须在返回前把新外观写进页面（用 flushSync 包住状态更新）。
   * origin 是圆形展开的圆心；系统自己切换深浅色时没有圆心，用颜色渐变。
   */
  const switchTheme = useCallback((to: ResolvedTheme, apply: () => void, origin: Point | null) => {
    const kind = chooseThemeTransition({
      from: resolvedRef.current,
      to,
      reducedMotion: window.matchMedia(REDUCED_MOTION_QUERY).matches,
      supportsViewTransition: typeof document.startViewTransition === 'function',
      hasOrigin: origin !== null,
    });
    const root = document.documentElement;

    if (kind === 'fade') {
      root.classList.add(FADE_CLASS);
      apply();
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = window.setTimeout(
        () => root.classList.remove(FADE_CLASS),
        FADE_CLEANUP_MS,
      );
      return;
    }

    if (kind !== 'reveal' || origin === null) {
      apply();
      return;
    }

    // 新外观从圆心以圆形展开，盖过旧外观的截图
    const radius = revealRadius(origin, window.innerWidth, window.innerHeight);
    const transition = document.startViewTransition(apply);
    revealRef.current = transition;
    const clear = () => {
      if (revealRef.current === transition) {
        revealRef.current = null;
      }
    };
    transition.finished.then(clear, clear);
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: revealClipPath(origin, radius) },
          {
            duration: REVEAL_DURATION_MS,
            easing: REVEAL_EASING,
            pseudoElement: '::view-transition-new(root)',
          },
        );
      })
      .catch(() => {});
  }, []);

  /**
   * 圆形展开播放中再开始新的视图过渡会打断它（画面跳一下），所以等它播完。
   * 页面拿不到渲染帧时过渡可能迟迟不结束，最多等 REVEAL_WAIT_LIMIT_MS，免得之后的切换一直排队
   */
  const afterReveal = useCallback((run: () => void) => {
    const active = revealRef.current;
    if (!active) {
      run();
      return;
    }
    let done = false;
    const once = () => {
      if (!done) {
        done = true;
        run();
      }
    };
    active.finished.then(once, once);
    window.setTimeout(once, REVEAL_WAIT_LIMIT_MS);
  }, []);

  // 跟随系统时，系统自己切换深浅色：整体颜色渐变，不做圆形展开
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const handleChange = () => {
      afterReveal(() => {
        const dark = query.matches;
        switchTheme(
          resolveTheme(preferenceRef.current, dark),
          () => flushSync(() => setSystemPrefersDark(dark)),
          null,
        );
      });
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [afterReveal, switchTheme]);

  const setPreference = useCallback(
    (next: ThemePreference, origin?: Point) => {
      const request = ++requestRef.current;
      storePreference(next);

      // systemDark 为 null 表示手动选了浅色 / 深色，用不到系统外观
      const start = (to: ResolvedTheme, systemDark: boolean | null) => {
        afterReveal(() => {
          // 等待期间又点了别的卡片：以最后一次为准
          if (request !== requestRef.current) {
            return;
          }
          switchTheme(
            to,
            () =>
              flushSync(() => {
                setPreferenceState(next);
                if (systemDark !== null) {
                  setSystemPrefersDark(systemDark);
                }
              }),
            origin ?? null,
          );
        });
      };

      if (next !== 'system') {
        start(next, null);
        return;
      }
      void readSystemPrefersDark().then((systemDark) => {
        if (request !== requestRef.current) {
          // 已被新点击取代，但上面已把窗口主题交还系统：按当前选择重新同步一次
          syncNativeTheme(preferenceRef.current);
          return;
        }
        start(resolveTheme('system', systemDark), systemDark);
      });
    },
    [afterReveal, switchTheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
