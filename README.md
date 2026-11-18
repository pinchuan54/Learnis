<div align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" height="96" alt="Learnis" />
  <h1>Learnis</h1>
  <p>本地运行的学习计划与计时软件</p>
  <p>
    <a href="https://github.com/pinchuan54/Learnis/releases/latest"><img src="https://img.shields.io/github/v/release/pinchuan54/Learnis" alt="最新版本" /></a>
    <img src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6" alt="支持 Windows 10 / 11" />
    <a href="LICENSE"><img src="https://img.shields.io/github/license/pinchuan54/Learnis" alt="MIT 协议" /></a>
  </p>
  <p>
    <a href="https://github.com/pinchuan54/Learnis/releases/latest">下载</a> ·
    <a href="CHANGELOG.md">更新日志</a> ·
    <a href="CONTRIBUTING.md">参与开发</a>
  </p>
</div>

为想掌握的技能设定「总时长 + 期限」（例如：AE，1000 小时，明年 6 月前），Learnis 会把时长分配到期限内的每个学习日；每天打开计时器记录实际学习时间，在月历上一眼看清进度。

## 功能

- **学习计划**：总时长 + 期限，可设置学习日，自动均分到每天
- **月历视图**：每天一个进度环，达标 / 多学 / 进行中 / 没学够 / 有调整一目了然
- **日详情**：各计划目标、待办清单、学习记录与调整记录
- **计时器**：正计时 / 倒计时随时切换，电子计时器与物理秒表两种外观，超额学习单独标出；今天的目标学完时提醒，暂不暂停由你决定
- **拖动调整时间**：忘了开计时或多算了时间，直接拖动计时器的数字、转动秒表指针补上或扣掉，记成当天的手动修正，可以撤销
- **灵活调整**：没学够的时长可均分到后续、拆分到指定日子或全部加到下一天
- **补录与修改**：忘记计时也能手动补录
- **托盘常驻与全局快捷键**：后台计时，一键开始 / 暂停（默认 `Ctrl+Shift+F12`，可在设置里改）
- **开机自启**：登录系统后自动运行，可选静默启动（不打开窗口，只在托盘待命）
- **外观**：浅色 / 深色 / 跟随系统，时区可独立于系统设置
- **一键更新**：在设置页检查更新，自动下载、校验签名并安装

## 安装

1. 在 [Releases](https://github.com/pinchuan54/Learnis/releases/latest) 下载最新的 `Learnis_x.y.z_x64-setup.exe`
2. 双击安装，按当前用户安装，不需要管理员权限
3. 安装包暂未做代码签名，首次运行时 Windows 可能提示「已保护你的电脑」，点击「更多信息 → 仍要运行」即可

系统要求：Windows 10 / 11。程序依赖 WebView2 运行时，Windows 11 已自带，Windows 10 缺少时安装程序会自动安装。界面为简体中文。

## 更新

在「设置 → 关于」点「检查更新」，有新版本时点「立即更新」即可。v0.1.1 及更早的版本没有这个功能，需要按上面的步骤手动安装一次新版本。

各版本的改动见 [更新日志](CHANGELOG.md)。

## 数据与隐私

- 所有数据保存在本机的 `%APPDATA%\io.github.pinchuan54.learnis\` 文件夹；要备份时，先在托盘菜单点「退出 Learnis」，再复制整个文件夹
- 只有点「检查更新」时才会联网访问 GitHub，不在后台自动检查，也不收集任何使用数据

## 参与开发

Learnis 基于 [Tauri 2](https://tauri.app/)（Rust）+ React + TypeScript + SQLite 开发。欢迎在 [Issues](https://github.com/pinchuan54/Learnis/issues) 反馈问题和建议；开发环境、常用命令、代码结构和贡献者见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE) © 2026 pinchuan54
