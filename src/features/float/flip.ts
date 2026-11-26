/**
 * 翻页小牌：正计时往下翻（上半张带着旧数字往下折，下半张带着新数字落下来），倒计时反过来往上翻。
 * 直接改 DOM，不走 React 渲染。
 */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Side = 'up' | 'lo';

function half(kind: 'half' | 'flap', side: Side, text: string) {
  const el = document.createElement('span');
  el.className = `${kind} ${side}`;
  const b = document.createElement('b');
  b.textContent = text;
  el.append(b);
  return el;
}

/** 翻到 text；reverse 为真时往上翻 */
export function flipTo(card: HTMLElement, text: string, animate: boolean, reverse: boolean) {
  const old = card.dataset.v;
  if (old === text) return;
  card.dataset.v = text;
  if (old === undefined) {
    // 第一次：撑宽度的隐形文字 + 上下两半
    const sizer = document.createElement('i');
    sizer.className = 'sz';
    sizer.textContent = text;
    card.replaceChildren(sizer, half('half', 'up', text), half('half', 'lo', text));
    return;
  }
  const [sizer, up, lo] = [...card.children] as HTMLElement[];
  sizer.textContent = text;
  const halves: Record<Side, HTMLElement> = { up, lo };
  if (!animate || reduced()) {
    for (const side of [up, lo]) side.firstElementChild!.textContent = text;
    return;
  }
  // 先折走的一半露出底下的新数字，另一半带着新数字翻过来
  const [first, second]: Side[] = reverse ? ['lo', 'up'] : ['up', 'lo'];
  halves[first].firstElementChild!.textContent = text;
  const deg = first === 'up' ? -90 : 90;
  const fold = half('flap', first, old);
  const drop = half('flap', second, text);
  card.append(fold, drop);
  // 翻到竖起来时背着光，暗一些
  fold.animate(
    [
      { transform: 'rotateX(0deg)' },
      { transform: `rotateX(${deg}deg)`, filter: 'brightness(0.75)' },
    ],
    { duration: 230, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)', fill: 'forwards' },
  ).onfinish = () => fold.remove();
  drop.animate(
    [
      { transform: `rotateX(${-deg}deg)`, filter: 'brightness(0.75)' },
      { transform: 'rotateX(0deg)' },
    ],
    {
      duration: 300,
      delay: 230,
      easing: 'cubic-bezier(0.3, 1.4, 0.6, 1)',
      fill: 'backwards',
    },
  ).onfinish = () => {
    halves[second].firstElementChild!.textContent = card.dataset.v ?? text;
    drop.remove();
  };
}
