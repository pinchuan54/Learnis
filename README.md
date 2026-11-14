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
- [Rust](https://www.rust-lang.org/tools/install) 稳定版（1.90 及以上）
- Windows：Microsoft C++ 生成工具（勾选「使用 C++ 的桌面开发」）与 WebView2 运行时（Windows 11 已自带）

详见 [Tauri 环境准备](https://tauri.app/start/prerequisites/)。

### 常用命令

```bash
npm install          # 安装依赖
npm run tauri dev    # 启动桌面应用（开发模式，支持热更新）
npm run dev          # 只在浏览器中预览界面（没有窗口按钮）
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
npm run rust:test    # Rust 单元测试
```

### 架构

- **Rust 端是唯一的数据来源**：SQLite 存储、计划分配、计时、调整、统计都在 `src-tauri/src/domain` 中实现并配单元测试；前端只负责界面，通过命令读写数据。
- **时间约定**：时间点存 UTC 毫秒；「哪一天」按设置中的时区计算，日界线为该时区 0 点，跨天的学习记录自动切分。
- **计时可靠**：只记录开始 / 结束时间戳，关闭窗口、崩溃、重启都不会丢失计时。
- **目标 = 基础分配 − 调出 + 调入**：创建计划时均分到学习日；没学够的时长挂起，可均分、拆分或顺延；学超的部分只计入总时长。

数据文件位于应用数据目录（Windows：`%APPDATA%\io.github.pinchuan54.learnis\`），正式版为 `learnis.db`，开发版为 `learnis-dev.db`，互不影响。

### 目录结构

```
src/                 前端（React + TypeScript）
  api/               类型化的后端调用、数据查询（TanStack Query）与后台事件同步
  components/        通用组件（顶部导航栏、窗口按钮、图标）
    ui/              基础控件（按钮、面板、分段控件、开关、小日历、进度环、提示条）
  features/          功能模块：计划、月历、计时器、日详情、未达标调整
  hooks/             通用 React 钩子
  layouts/           页面外壳
  pages/             各页面（今天 / 某天、月历、计划、设置）
  theme/             外观（浅色 / 深色 / 跟随系统）
  lib/               与界面无关的工具函数（配单元测试）
  styles/            设计令牌、配色与通用区块样式
public/              静态文件（渲染前应用外观的脚本）
src-tauri/src/       桌面端（Rust）
  db/                SQLite 连接与表结构迁移
  domain/            业务逻辑：计划分配、计时、调整、待办、设置、概览统计
  desktop/           托盘、全局快捷键、计时监视（自动暂停、长时间提醒）与系统通知
  commands.rs        暴露给前端的命令
  time.rs            时区、日界线与跨天切分
```

## 版本

版本号采用 `主版本.次版本.补丁` 格式：首个版本为 v0.1.0，之后的补丁依次为 v0.1.1、v0.1.2……，积累到一定程度升级为 v0.2.0。

## 贡献者

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/pinchuan54">
        <img src="https://github.com/pinchuan54.png?size=160" width="80" height="80" alt="pinchuan54" /><br />
        <sub><b>pinchuan54</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/claude">
        <img src="https://github.com/claude.png?size=160" width="80" height="80" alt="Claude" /><br />
        <sub><b>Claude</b></sub>
      </a>
    </td>
  </tr>
</table>
