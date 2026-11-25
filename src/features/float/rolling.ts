/**
 * 滚动数字：每一位一个槽，变了就让旧数字滑出、新数字滑入（数值变大往上滚，变小往下滚）；
 * 位数变化时槽的宽度平滑伸缩。直接改 DOM，不走 React 渲染。
 */

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function roll(slot: HTMLElement, ch: string, dir: number, animate: boolean) {
  slot.dataset.ch = ch;
  slot.classList.toggle('colon', ch === ':');
  const next = document.createElement('span');
  next.className = 'c';
  next.textContent = ch;
  const prev = [...slot.children].find((c) => !c.classList.contains('out'));
  if (!animate || !prev) {
    slot.replaceChildren(next);
    return;
  }
  prev.classList.add('out');
  slot.append(next);
  slot.classList.add('rolling');
  const d = dir >= 0 ? 1 : -1;
  next.animate([{ transform: `translateY(${d * 100}%)` }, { transform: 'translateY(0)' }], {
    duration: 560,
    easing: EASE,
  });
  const out = prev.animate(
    [
      { transform: 'translateY(0)', opacity: 1 },
      { transform: `translateY(${-d * 100}%)`, opacity: 0 },
    ],
    { duration: 560, easing: EASE, fill: 'forwards' },
  );
  out.onfinish = () => {
    prev.remove();
    if (!slot.querySelector('.out')) slot.classList.remove('rolling');
  };
}

/** 把 el 里的文字换成 text；dir 为正时往上滚，为负时往下滚 */
export function setRollingText(el: HTMLElement, text: string, dir: number, animate: boolean) {
  if (el.dataset.text === text) return;
  el.dataset.text = text;
  const motion = animate && !reduced();
  const slots = [...el.children].filter((s) => !s.classList.contains('gone')) as HTMLElement[];
  while (slots.length < text.length) {
    const slot = document.createElement('span');
    slot.className = 's';
    slot.dataset.fresh = '1';
    el.prepend(slot);
    slots.unshift(slot);
  }
  while (slots.length > text.length) {
    const slot = slots.shift() as HTMLElement;
    if (!motion) {
      slot.remove();
      continue;
    }
    slot.classList.add('gone');
    slot.animate(
      [
        { width: `${slot.offsetWidth}px`, opacity: 1 },
        { width: '0px', opacity: 0 },
      ],
      {
        duration: 420,
        easing: EASE,
      },
    ).onfinish = () => slot.remove();
  }
  slots.forEach((slot, i) => {
    const fresh = slot.dataset.fresh;
    delete slot.dataset.fresh;
    if (slot.dataset.ch !== text[i]) roll(slot, text[i], dir, motion && !fresh);
    if (fresh && motion) {
      slot.animate(
        [
          { width: '0px', opacity: 0 },
          { width: `${slot.offsetWidth}px`, opacity: 1 },
        ],
        {
          duration: 420,
          easing: EASE,
        },
      );
    }
  });
}
