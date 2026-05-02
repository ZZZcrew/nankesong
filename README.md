# 南柯松 · 前端

24h 黑客松项目"南柯松"的前端部分。

> 完整产品设计见 [docs/superpowers/specs/2026-05-02-ai-family-diary-design.md](docs/superpowers/specs/2026-05-02-ai-family-diary-design.md)

## 结构

```
apps/
├── filter/    滑动筛图页（clip-level 隐私控制，端口 5173）
├── junior/    小辈端审核页（端口 5174）
└── senior/    长辈端阅读页（端口 5175，Demo 命门）
```

每个 app 独立安装依赖、独立启动，互不干扰。

## 开发

首次进某个 app：

```bash
cd apps/junior    # 或 filter / senior
npm install
npm run dev
```

三个页面端口不冲突，需要的话可以同时开三个终端分别跑。

## 技术栈

- **filter**: React + Vite + TS + 纯 CSS + @use-gesture + react-spring
- **junior / senior**: React + Vite + TS + Tailwind v3

filter 用的纯 CSS，junior 和 senior 用 Tailwind（对齐 spec §8）。

## 当前状态

- filter：UI 完成，功能跑通，数据源是 `src/assets/images/`，提交走 `VITE_SUBMIT_URL`
- junior：静态视觉稿，mock 数据，段落"删除/恢复"可点
- senior：静态视觉稿，mock 数据，封面轮播可切换、朗读进度条、按住说话按钮（视觉）

所有页面当前都不接真后端。后端就绪后按 spec §6 的 API 契约接入。
