# 参与开发

感谢关注 Learnis！发现问题或有想法，欢迎在 [Issues](https://github.com/pinchuan54/Learnis/issues) 里提出。想直接改代码的话，建议先开一个 issue 说明要做什么，再提交 Pull Request。

## 环境要求

- [Node.js](https://nodejs.org/) 20.19 及以上
- [Rust](https://www.rust-lang.org/tools/install) 稳定版（1.90 及以上）
- Windows：Microsoft C++ 生成工具（勾选「使用 C++ 的桌面开发」）与 WebView2 运行时（Windows 11 已自带）

详见 [Tauri 环境准备](https://tauri.app/start/prerequisites/)。

## 常用命令

```bash
npm install          # 安装依赖
npm run tauri dev    # 启动桌面应用（开发模式，支持热更新）
npm run dev          # 只在浏览器中预览界面（没有窗口按钮）
npm run tauri build  # 构建安装包
```

开发版和正式版使用各自的数据库（应用数据目录下的 `learnis-dev.db` 与 `learnis.db`），互不影响。

### 构建安装包

安装包会附带自动更新用的签名，构建时需要在环境变量 `TAURI_SIGNING_PRIVATE_KEY` 中提供签名私钥。没有私钥时，可以把 `src-tauri/tauri.conf.json` 中的 `createUpdaterArtifacts` 改为 `false` 再构建（这样构建出的安装包不能用于发布更新）。

`npm run build:dev` 打的是本地测试包：不生成更新签名，编号形如 `v0.2.4-dev.1`，安装包放在 `src-tauri/target/dev-installer/`，不用于发布。

## 代码检查

提交前请确认 `npm run check` 和 `npm run build` 都能通过。

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

## 架构

- **Rust 端是唯一的数据来源**：SQLite 存储、计划分配、计时、调整、统计都在 `src-tauri/src/domain` 中实现并配单元测试；前端只负责界面，通过命令读写数据。
- **时间约定**：时间点存 UTC 毫秒；「哪一天」按设置中的时区计算，日界线为该时区 0 点，跨天的学习记录自动切分。
- **计时可靠**：只记录开始 / 结束时间戳，关闭窗口、崩溃、重启都不会丢失计时。
- **目标 = 基础分配 − 调出 + 调入**：创建计划时均分到学习日；没学够的时长挂起，可均分、拆分或顺延；学超的部分只计入总时长。

## 目录结构

```
src/                 前端（React + TypeScript）
  api/               类型化的后端调用、数据查询（TanStack Query）与后台事件同步
  components/        通用组件（顶部导航栏、窗口按钮、图标）
    ui/              基础控件（按钮、面板、分段控件、开关、小日历、进度环、提示条）
  features/          功能模块：计划、月历、计时器、日详情、未达标调整、检查更新
  hooks/             通用 React 钩子
  layouts/           页面外壳
  pages/             各页面（今天 / 某天、月历、计划、设置）
  theme/             外观（浅色 / 深色 / 跟随系统）
  lib/               与界面无关的工具函数（配单元测试）
  styles/            设计令牌、配色与通用区块样式
public/              静态文件（渲染前应用外观的脚本）
prototypes/          交互原型（独立网页，不参与构建）：timer-drag 是计时器拖动调时间的手感原型
scripts/             发版脚本（生成自动更新用的 latest.json、打本地测试包）
src-tauri/src/       桌面端（Rust）
  db/                SQLite 连接与表结构迁移
  domain/            业务逻辑：计划分配、计时、调整、待办、设置、概览统计
  desktop/           托盘、全局快捷键、计时监视（归零提醒、长时间提醒）、系统通知、开机自启与检查更新
  commands.rs        暴露给前端的命令
  time.rs            时区、日界线与跨天切分
```

## 提交规范

- **分支**：从最新的 `main` 拉出，命名为 `feat/<issue号>-简述`、`fix/<issue号>-简述`、`docs/…`、`chore/…`
- **提交信息**：`类型: 中文描述 (#issue号)`，类型用 `feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `style` / `perf`，例如 `fix: 拖动调整时间时，顶部计时胶囊保持计时状态 (#46)`
- **Pull Request**：正文写关联的 issue（`Closes #n`）、改动内容和验证方式，合并时使用 squash
- **代码约定**：
  - 文本文件统一 LF 换行、UTF-8 无 BOM
  - 注释用中文，标识符用英文
  - 业务逻辑放在 `src-tauri/src/domain/` 并配单元测试，命令层只做转发
  - 数据库迁移脚本只能追加，不能修改已有的
  - 计划时长用分钟，学习时长用秒
  - 界面改动要同时照顾浅色和深色外观

## 版本

版本号采用 `主版本.次版本.补丁` 格式（语义化版本），界面中补丁号为 0 时省略（`0.2.0` 显示为 v0.2）。修复和小改动合并后发布补丁版本（v0.2.1、v0.2.2……），较大的新功能升次版本号。每个版本的改动写在 [CHANGELOG.md](CHANGELOG.md)。

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
