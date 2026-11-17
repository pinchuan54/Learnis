import { describe, expect, it } from 'vitest';
import { DialController, type DialServerState } from './controller';

const FRAME = 1000 / 120;

function setup(overrides: Partial<DialServerState> = {}) {
  const calls: string[] = [];
  const controller = new DialController({
    stopTimer: async () => calls.push('stop'),
    addCorrection: async (planId, seconds, resume) =>
      calls.push(`correction ${planId} ${seconds} ${resume}`),
    refresh: async () => calls.push('refresh'),
    onError: (error) => {
      throw error;
    },
  });
  controller.setServer({
    planId: 7,
    targetSeconds: 7500,
    display: 'countUp',
    running: true,
    studiedSeconds: 3180,
    studiedAt: 0,
    dayStartMs: -15 * 3600 * 1000,
    ...overrides,
  });
  return { controller, calls };
}

/** 在「分」这一栏上拖 minutes 分钟（表上的数往上为正），用时 ms */
function dragMinutes(controller: DialController, minutes: number, ms: number, t0: number): number {
  const frames = Math.round(ms / FRAME);
  let t = t0;
  for (let i = 0; i < frames; i++) {
    t += FRAME;
    controller.drag((minutes * 60) / frames, t);
    controller.tick(t);
  }
  return t;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('DialController', () => {
  it('按住先暂停，松手时当场记修正并接着计时，请求按顺序发出', async () => {
    const { controller, calls } = setup();
    controller.tick(1000);
    controller.grab('digital', 'minute', 60, 1000);
    // 按住期间计时停住
    expect(controller.learnedAt(5000)).toBeCloseTo(3181, 5);
    const t = dragMinutes(controller, 2.4, 400, 1000);
    // 停住一会儿再松手：顺着方向落到 +3 分钟
    controller.release(t + 300);
    expect(controller.learnedAt(t + 300)).toBeCloseTo(3181 + 180, 5);
    // 松手后接着计时
    expect(controller.learnedAt(t + 1300)).toBeCloseTo(3181 + 180 + 1, 5);
    await flush();
    await flush();
    expect(calls).toEqual(['stop', 'correction 7 180 true', 'refresh']);
  });

  it('倒计时下把剩余往上拨等于少学，徽标显示这一轮的合计', async () => {
    const { controller, calls } = setup({ display: 'countDown', running: false });
    controller.tick(0);
    controller.grab('analog', 'minute', 60, 0);
    const t = dragMinutes(controller, 3, 400, 0);
    controller.release(t + 300);
    const frame = controller.tick(t + 320);
    expect(frame?.badge).toMatchObject({
      visible: true,
      owner: 'analog',
      sum: -180,
      canUndo: true,
    });
    await flush();
    expect(calls).toEqual(['correction 7 -180 false', 'refresh']);
  });

  it('撤销整轮：发出相反的修正，本地合计马上退回去', async () => {
    const { controller, calls } = setup({ running: false });
    controller.tick(0);
    controller.nudge('digital', 'second', 1, 5, 0);
    controller.nudge('digital', 'minute', 60, 1, 10);
    expect(controller.learnedAt(20)).toBe(3180 + 65);
    controller.undo();
    expect(controller.learnedAt(20)).toBe(3180);
    await flush();
    await flush();
    expect(calls).toEqual([
      'correction 7 5 false',
      'correction 7 60 false',
      'correction 7 -65 false',
      'refresh',
    ]);
  });

  it('不能扣到 0 以下', () => {
    const { controller } = setup({ running: false, studiedSeconds: 100 });
    controller.tick(0);
    controller.nudge('digital', 'minute', 60, -5, 0);
    expect(controller.learnedAt(0)).toBe(0);
  });
});
