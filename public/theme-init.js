// 在页面渲染前应用上次选择的外观，避免启动时闪屏。
// 逻辑与 src/lib/theme.ts 保持一致，存储键为 learnis.theme。
(function () {
  var preference = 'system';
  try {
    var stored = window.localStorage.getItem('learnis.theme');
    if (stored === 'light' || stored === 'dark') {
      preference = stored;
    }
  } catch (error) {
    // 存储不可用时跟随系统
  }
  var dark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
