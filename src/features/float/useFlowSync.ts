import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { rampFlow, restartFlow } from './flow';

interface Base {
  /** 服务端算的今天已学秒数和对应的时刻 */
  seconds: number;
  at: number;
  /** 服务端的计时状态（算已学秒数用） */
  running: boolean;
}

/**
 * 让「时间在走」的动画和今天已学的秒数对上：
 * - 换形态、流逝感、正倒计时（structure 变了），或者已学秒数跳了（手动修正、跨天），按当前秒数重新开始；
 *   正常走秒、开始、暂停都不重新开始，免得打断慢慢停下 / 动起来；
 * - running（界面上的状态，点按钮后立刻变）变了：慢慢动起来 / 停下。
 */
export function useFlowSync(
  root: RefObject<HTMLElement | null>,
  structure: string,
  base: Base,
  running: boolean,
) {
  const expected = useRef<{ at: number; seconds: number; running: boolean } | null>(null);
  const lastStructure = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const now = Date.now();
    const actual = base.seconds + (base.running ? Math.max(0, (now - base.at) / 1000) : 0);
    const prev = expected.current;
    const predicted = prev ? prev.seconds + (prev.running ? (now - prev.at) / 1000 : 0) : NaN;
    if (structure !== lastStructure.current || !(Math.abs(actual - predicted) <= 2)) {
      restartFlow(el, actual, base.running);
    }
    lastStructure.current = structure;
    expected.current = { at: now, seconds: actual, running: base.running };
  }, [root, structure, base.seconds, base.at, base.running]);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (root.current) rampFlow(root.current, running);
  }, [root, running]);
}
