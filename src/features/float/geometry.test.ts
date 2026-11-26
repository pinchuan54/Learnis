import { describe, expect, it } from 'vitest';
import {
  areaAt,
  EDGE_GAP,
  keepInside,
  PAD,
  type Placement,
  resizeRatio,
  settle,
  windowPosition,
  windowSize,
} from './geometry';

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

  it('没贴边时让悬浮窗中心落在记下的中心，拖出屏幕外会被拉回来', () => {
    const { x, y } = windowPosition({ ax: null, ay: null, cx: 960, cy: 500 }, size, area, 1);
    expect(x).toBe(Math.round(960 - 64.5));
    // 悬浮窗在窗口里上边距 16、下边距 22，中心 = 窗口顶 + 16 + (72 - 38) / 2
    expect(y + PAD.top + (size.height - PAD.top - PAD.bottom) / 2).toBe(500);
    const out = windowPosition({ ax: null, ay: null, cx: 5000, cy: -300 }, size, area, 1);
    expect(out.x + size.width - PAD.side).toBe(area.width);
    expect(out.y + PAD.top).toBe(0);
  });
});

describe('settle', () => {
  it('靠近边缘就贴过去，否则记下悬浮窗中心', () => {
    const nearRight = { x: 1920 - 90 - 20, y: 400, width: 90, height: 30 };
    expect(settle(nearRight, area, 1)).toMatchObject({ ax: 'right', ay: null, cy: 415 });

    const middle = { x: 800, y: 400, width: 90, height: 30 };
    expect(settle(middle, area, 1)).toEqual({ ax: null, ay: null, cx: 845, cy: 415 });
  });

  it('按 dpr 换算吸附距离', () => {
    expect(settle({ x: 800, y: 50, width: 180, height: 60 }, area, 2).ay).toBe('top');
    expect(settle({ x: 800, y: 70, width: 180, height: 60 }, area, 2).ay).toBe(null);
  });
});

describe('keepInside', () => {
  it('拖到屏幕外时停在离边缘 EDGE_GAP 处，屏幕里不动', () => {
    const box = { width: 90, height: 30 };
    expect(keepInside({ ...box, x: -50, y: 2000 }, area, 1)).toEqual({
      x: EDGE_GAP,
      y: area.height - 30 - EDGE_GAP,
    });
    expect(keepInside({ ...box, x: 500, y: 300 }, area, 1)).toEqual({ x: 500, y: 300 });
  });
});

describe('areaAt', () => {
  const second = { x: 1920, y: 0, width: 2560, height: 1400 };

  it('找鼠标所在的屏幕，落在屏幕外取最近的', () => {
    expect(areaAt([area, second], 2000, 500)).toBe(second);
    expect(areaAt([area, second], 100, 1300)).toBe(area);
    expect(areaAt([], 0, 0)).toBeNull();
  });
});

describe('resizeRatio', () => {
  const box = { width: 100, height: 40 };
  const free: Placement = { ax: null, ay: null, cx: 0, cy: 0 };
  const topRight: Placement = { ax: 'right', ay: 'top', cx: 0, cy: 0 };

  it('贴右上时拖角在左下，往左下拖放大，往右上拖缩小', () => {
    expect(resizeRatio(-100, 40, box, topRight)).toBeCloseTo(2);
    expect(resizeRatio(50, -20, box, topRight)).toBeCloseTo(0.5);
    // 只横着拖：按拖角离鼠标最近算
    expect(resizeRatio(-100, 0, box, topRight)).toBeCloseTo(1 + 10000 / 11600);
  });

  it('没贴边时从中心放大，拖角只走一半，同样的位移放大两倍', () => {
    expect(resizeRatio(50, 20, box, free)).toBeCloseTo(2);
  });
});
