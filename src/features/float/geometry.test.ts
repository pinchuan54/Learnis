import { describe, expect, it } from 'vitest';
import { EDGE_GAP, PAD, settle, windowPosition, windowSize } from './geometry';

const area = { x: 0, y: 0, width: 1920, height: 1040 };

describe('windowSize', () => {
  it('悬浮窗大小加上展开余量、悬停放大和四周边距', () => {
    // (82 + 7) × 1.04 + 36 = 128.56 → 129；32 × 1.04 + 38 = 71.28 → 72
    expect(windowSize({ width: 82, height: 32 }, 7, 1)).toEqual({ width: 129, height: 72 });
    expect(windowSize({ width: 82, height: 32 }, 7, 1.5)).toEqual({ width: 193, height: 107 });
  });
});

describe('windowPosition', () => {
  const size = { width: 129, height: 72 };

  it('贴右上：悬浮窗离右边、上边各 EDGE_GAP', () => {
    const { x, y } = windowPosition({ ax: 'right', ay: 'top', cx: 0, cy: 0 }, size, area, 1);
    expect(x + size.width - PAD.side).toBe(area.width - EDGE_GAP);
    expect(y + PAD.top).toBe(EDGE_GAP);
  });

  it('贴左下：按下边距算，不会被任务栏挡住', () => {
    const { x, y } = windowPosition({ ax: 'left', ay: 'bottom', cx: 0, cy: 0 }, size, area, 1);
    expect(x + PAD.side).toBe(EDGE_GAP);
    expect(y + size.height - PAD.bottom).toBe(area.height - EDGE_GAP);
  });

  it('没贴边时以中心为准，拖出屏幕外会被拉回来', () => {
    expect(windowPosition({ ax: null, ay: null, cx: 960, cy: 500 }, size, area, 1)).toEqual({
      x: Math.round(960 - 64.5),
      y: 464,
    });
    const out = windowPosition({ ax: null, ay: null, cx: 5000, cy: -300 }, size, area, 1);
    expect(out.x + size.width - PAD.side).toBe(area.width);
    expect(out.y + PAD.top).toBe(0);
  });
});

describe('settle', () => {
  it('靠近边缘就贴过去，否则记下窗口中心', () => {
    const nearRight = { x: 1920 - 129 + PAD.side - 20, y: 400, width: 129, height: 72 };
    expect(settle(nearRight, area, 1)).toMatchObject({ ax: 'right', ay: null, cy: 436 });

    const middle = { x: 800, y: 400, width: 129, height: 72 };
    expect(settle(middle, area, 1)).toEqual({ ax: null, ay: null, cx: 864.5, cy: 436 });
  });

  it('按 dpr 换算吸附距离', () => {
    const nearTop = { x: 800, y: -PAD.top * 2 + 50, width: 258, height: 144 };
    expect(settle(nearTop, area, 2).ay).toBe('top');
  });
});
