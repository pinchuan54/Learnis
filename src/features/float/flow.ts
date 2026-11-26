/**
 * 「时间在走」的 CSS 动画：刻度带、分钟线、刻度盘（都只动位移和旋转）。
 * - restartFlow：按当前秒数设好起点（--phase）再重新开始，整分钟的长刻度正好在那一刻走过播放头；
 * - rampFlow：暂停像唱片机断电，0.45 秒内慢慢停住；开始时同样慢慢动起来（只改播放速度，位置不跳）。
 */

const FLOW_ANIMATIONS = new Set(['ruler', 'dial', 'mline', 'marc']);
let rampId = 0;

function flowAnimations(root: HTMLElement) {
  return root
    .getAnimations({ subtree: true })
    .filter((a) => a instanceof CSSAnimation && FLOW_ANIMATIONS.has(a.animationName));
}

/** seconds：今天已学的秒数（带小数），决定每分钟一圈的动画走到哪 */
export function restartFlow(root: HTMLElement, seconds: number, running: boolean) {
  root.style.setProperty('--phase', `-${seconds % 60}s`);
  root.classList.remove('flowing');
  void root.offsetWidth;
  root.classList.add('flowing');
  rampId += 1;
  if (!running) {
    for (const a of flowAnimations(root)) {
      a.playbackRate = 0;
      a.pause();
    }
  }
}

export function rampFlow(root: HTMLElement, running: boolean) {
  const id = ++rampId;
  const anims = flowAnimations(root);
  if (!anims.length) return;
  const to = running ? 1 : 0;
  const from = anims[0].playState === 'paused' ? 0 : anims[0].playbackRate;
  if (running) for (const a of anims) a.play();
  const start = performance.now();
  const step = (now: number) => {
    if (id !== rampId) return;
    const t = Math.min((now - start) / 450, 1);
    const rate = from + (to - from) * t * t * (3 - 2 * t);
    for (const a of anims) a.playbackRate = rate;
    if (t < 1) requestAnimationFrame(step);
    else if (!running) for (const a of anims) a.pause();
  };
  requestAnimationFrame(step);
}
