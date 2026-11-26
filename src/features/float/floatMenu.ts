import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import type { FloatFlow, FloatForm, Settings } from '../../api/types';

const FORMS: [FloatForm, string][] = [
  ['minimal', '极简'],
  ['flip', '翻页'],
  ['dial', '小圆表'],
];

const FLOWS: [FloatFlow, string][] = [
  ['ruler', '刻度带'],
  ['minuteLine', '分钟线'],
  ['pulse', '秒脉搏'],
  ['none', '不显示'],
];

const SCALES = [80, 100, 125, 150, 200];

interface MenuActions {
  save: (patch: Partial<Settings>) => void;
  openMain: () => void;
  hide: () => void;
  openSettings: () => void;
}

/** 选一项的子菜单，当前项打勾 */
async function choices<T>(
  text: string,
  options: [T, string][],
  current: T,
  pick: (value: T) => void,
) {
  const items = await Promise.all(
    options.map(([value, label]) =>
      CheckMenuItem.new({ text: label, checked: value === current, action: () => pick(value) }),
    ),
  );
  return Submenu.new({ text, items });
}

/** 悬浮窗的右键菜单（系统原生菜单，和托盘菜单一个样子） */
export async function showFloatMenu(settings: Settings, actions: MenuActions) {
  const separator = () => PredefinedMenuItem.new({ item: 'Separator' });
  const menu = await Menu.new({
    items: [
      await MenuItem.new({ text: '打开 Learnis', action: actions.openMain }),
      await MenuItem.new({ text: '隐藏悬浮窗', action: actions.hide }),
      await separator(),
      await choices('形态', FORMS, settings.floatForm, (floatForm) => actions.save({ floatForm })),
      await choices('时间流逝感', FLOWS, settings.floatFlow, (floatFlow) =>
        actions.save({ floatFlow }),
      ),
      await choices(
        '大小',
        SCALES.map((scale): [number, string] => [scale, `${scale}%`]),
        settings.floatScale,
        (floatScale) => actions.save({ floatScale }),
      ),
      await separator(),
      await CheckMenuItem.new({
        text: '显示拖角',
        checked: settings.floatGrip,
        action: () => actions.save({ floatGrip: !settings.floatGrip }),
      }),
      await CheckMenuItem.new({
        text: '锁定位置',
        checked: settings.floatLocked,
        action: () => actions.save({ floatLocked: !settings.floatLocked }),
      }),
      await MenuItem.new({ text: '悬浮窗设置…', action: actions.openSettings }),
    ],
  });
  await menu.popup();
}
