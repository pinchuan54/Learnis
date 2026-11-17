/**
 * 临界阻尼弹簧：按精确解推进 dt 秒。
 * x 是离目标的距离，v 是速度，omega 越大收得越快；不会来回振荡。
 */
export function springStep(x: number, v: number, omega: number, dt: number): [number, number] {
  const e = Math.exp(-omega * dt);
  const k = (v + omega * x) * dt;
  return [(x + k) * e, (v - omega * k) * e];
}

/** 顺着方向取整：往上拨落到上面那一格，往下拨落到下面那一格；没有方向时取最近的 */
export function roundToward(x: number, dir: number): number {
  if (dir > 0) return Math.ceil(x - 1e-6);
  if (dir < 0) return Math.floor(x + 1e-6);
  return Math.round(x);
}

/** 取模，结果总在 [0, n) 之间（负数也是） */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}
