# Learnis

一个本地运行的学习计划与计时软件。

为想掌握的技能设定「总时长 + 期限」（例如：AE，1000 小时，明年 6 月前），Learnis 会把时长分配到期限内的每个学习日；每天打开计时器记录实际学习时间，在月历上一眼看清进度。

> 当前处于 v0.1 开发阶段，仅支持 Windows，界面为简体中文。

## 功能规划（v0.1）

- **学习计划**：总时长 + 期限，可设置学习日，自动均分到每天
- **月历视图**：每天一个进度环，达标 / 部分完成 / 未学 / 休息一目了然
- **日详情**：今日各计划目标、待办清单、当日学习记录
- **计时器**：正计时 / 倒计时随时切换，电子计时器与物理秒表两种外观，超额学习单独标出
- **灵活调整**：没学够的时长可均分到后续、拆分到指定日子或全部加到下一天
- **补录与修改**：忘记计时也能手动补录
- **托盘常驻与全局快捷键**：后台计时，一键开始 / 暂停
- **时区设置**：可独立于系统时区
- **数据本地存储**：所有数据保存在本机，不联网

## 技术栈

- [Tauri 2](https://tauri.app/)（Rust）
- React + TypeScript + Vite
- SQLite

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) 20.19 及以上
- [Rust](https://www.rust-lang.org/tools/install) 稳定版（1.85 及以上）
- Windows：Microsoft C++ 生成工具（勾选「使用 C++ 的桌面开发」）与 WebView2 运行时（Windows 11 已自带）

详见 [Tauri 环境准备](https://tauri.app/start/prerequisites/)。

### 常用命令

```bash
npm install          # 安装依赖
npm run tauri dev    # 启动桌面应用（开发模式，支持热更新）
npm run dev          # 只在浏览器中预览界面（无 Mica 效果和窗口功能）
npm run tauri build  # 构建安装包
```

### 代码检查

```bash
npm run check        # 一次性运行下面全部检查
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint
npm run format:check # Prettier 格式检查（npm run format 自动修复）
npm test             # Vitest 单元测试
npm run rust:fmt     # Rust 格式检查
npm run rust:lint    # Clippy
```

### 目录结构

```
src/                 前端（React + TypeScript）
  components/        通用组件（标题栏、侧栏、图标）
  layouts/           页面外壳
  pages/             各页面
  lib/               与界面无关的工具和业务逻辑（配单元测试）
  styles/            设计令牌与全局样式
src-tauri/           桌面端（Rust）：窗口、数据存储与系统能力
```

## 版本

版本号采用 `主版本.次版本.补丁` 格式：首个版本为 v0.1.0，之后的补丁依次为 v0.1.1、v0.1.2……，积累到一定程度升级为 v0.2.0。

## 贡献者

- [pinchuan54](https://github.com/pinchuan54)
- Claude（Anthropic）
