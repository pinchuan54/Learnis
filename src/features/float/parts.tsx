import { useLayoutEffect, useRef } from 'react';
import { flipTo } from './flip';
import { setRollingText } from './rolling';

/** 滚动数字（每一位单独滚动）；dir 为正往上滚，为负往下滚 */
export function Rolling({
  text,
  dir,
  className,
}: {
  text: string;
  dir: number;
  className: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (ref.current) setRollingText(ref.current, text, dir, mounted.current);
    mounted.current = true;
  }, [text, dir]);
  return <span ref={ref} className={className} />;
}

/** 翻页小牌 */
export function FlipCard({
  text,
  reverse,
  hidden,
}: {
  text: string;
  reverse: boolean;
  hidden?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (ref.current) flipTo(ref.current, text, mounted.current, reverse);
    mounted.current = true;
  }, [text, reverse]);
  return <span ref={ref} className="fc" hidden={hidden} />;
}

/** 播放 ⇄ 暂停图标：三角形拆成两块四边形，和两根竖条互相变形（路径在 float.css 里按状态切换） */
export function PlayPause() {
  return (
    <svg className="pp" viewBox="0 0 24 24" aria-hidden="true">
      <path className="p1" d="M7 5L10.5 5L10.5 19L7 19Z" />
      <path className="p2" d="M13.5 5L17 5L17 19L13.5 19Z" />
    </svg>
  );
}

/** 小圆表的刻度盘：60 格，每 5 格一根长刻度，整分钟那根用计划色 */
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const angle = (i * 6 * Math.PI) / 180;
  const inner = i === 0 ? 17.2 : i % 5 === 0 ? 18.2 : 19.4;
  return {
    i,
    className: i === 0 ? 'm' : i % 5 === 0 ? 'l' : undefined,
    x1: 28 + inner * Math.cos(angle),
    y1: 28 + inner * Math.sin(angle),
    x2: 28 + 21 * Math.cos(angle),
    y2: 28 + 21 * Math.sin(angle),
  };
});

export function DialTicks() {
  return (
    <g className="dial">
      {TICKS.map(({ i, ...line }) => (
        <line key={i} {...line} />
      ))}
    </g>
  );
}
