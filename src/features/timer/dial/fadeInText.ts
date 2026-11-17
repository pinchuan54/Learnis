const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 换字时淡入，不直接跳；文字没变就什么也不做 */
export function fadeInText(el: HTMLElement | null, text: string): void {
  if (!el || el.textContent === text) return;
  const first = el.textContent === '';
  el.textContent = text;
  if (!first && !reducedMotion()) {
    el.animate(
      [
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 320, easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)' },
    );
  }
}
