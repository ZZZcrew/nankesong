# 南柯松 · 前端

24h 黑客松项目"南柯松"的前端部分。

> 完整产品设计见 [docs/superpowers/specs/2026-05-02-ai-family-diary-design.md](docs/superpowers/specs/2026-05-02-ai-family-diary-design.md)

## 结构

```
apps/
└── junior/    唯一的 Vite app
    ├── /                 小辈端（筛图 + 预览发送），旧 apps/filter 已合并进此流程
    └── /?role=senior     长辈端（相框阅读），旧 apps/senior 已合并成同项目内的 view
```

两端合并为一个 Vite app 的目的，是让 junior 发送给 senior 的数据通过 **localStorage + storage 事件** 即时中转 —— 只有同 origin 才能跨 tab 共享数据。未来接真后端后可再拆分。

## 开发

```bash
cd apps/junior
npm install
npm run dev
```

开两个浏览器标签验证链路：
- A（小辈）: `http://localhost:5174/`
- B（长辈）: `http://localhost:5174/?role=senior`

A 点"发送给妈妈" → B 通过 storage 事件自动刷新为 A 刚筛过的图片 + 对应配文。

## 技术栈

React 18 + Vite 5 + TypeScript + Tailwind v3。筛图交互用 `@use-gesture/react` + `@react-spring/web`。

## 数据流

```
apps/junior/src/assets/images/*.jpg
     │  import.meta.glob（Vite dev 或打包后的 URL）
     ▼
  FilterPage 上滑删 / 左右滑留 → kept[]
     │  AuditPage.send()
     ▼
  localStorage['nks-diary'] = {
    date, title, publishedAt,
    items: [{ id, url, caption }, ...]   // caption 目前取自 AuditPage 里的 mock CAPTIONS
  }
     │  storage event
     ▼
  SeniorView 相框轮播
```

- 图片文件唯一来源是 `apps/junior/src/assets/images/`
- 配文目前是 `AuditPage.tsx` 里 hardcoded 的 `CAPTIONS`，按 kept 数组顺序分配；后续可替换为 Claude 生成
- 没有任何 picsum / 远程占位图

## 当前状态

- 筛图 / 预览 / 发送链路：打通
- SeniorView：空态占位 + 接收到数据后轮播、进度条、暂停、按住说话按钮（视觉）
- 不接后端。按 spec §6 的 API 契约接入时，把 `localStorage.setItem` 换成 `fetch('/api/diary/publish')`、`localStorage.getItem` 换成 `fetch('/api/diary/latest')` 即可，数据结构不变
