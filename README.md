# 南柯松 · 代际沟通 AI 助手

> 24h 黑客松项目。把年轻人零碎的生活素材自动翻译成长辈友好的"家书"，再通过电子相框 + 语音对话让长辈听到、回应、留言。

完整产品需求见 [backend/docs/产品需求文档.md](backend/docs/产品需求文档.md)；前端原始 spec 见 [docs/superpowers/specs/2026-05-02-ai-family-diary-design.md](docs/superpowers/specs/2026-05-02-ai-family-diary-design.md)。

## 仓库结构

```
nks-page/
├── apps/junior/         前端 (React + Vite + TS + Tailwind)
│   ├── /                小辈端:筛图 → 预览 → 发送
│   └── /?role=senior    长辈端:相框朗读 + 语音问答
└── backend/             后端 (FastAPI + SQLite + OpenAI)
    ├── app/             主应用 (api / models / services / prompts)
    ├── data/famlink.db  SQLite 数据库 (运行后自动生成)
    ├── scripts/         初始化 + Mock 数据脚本
    └── docs/            产品 / 技术 / 接口文档
```

## 快速启动

### 后端

```bash
cd backend
pip install -r requirements.txt

# 配置环境变量
echo "OPENAI_API_KEY=sk-xxxxx" > .env

# 初始化数据库 + 灌 mock 数据
python scripts/mock_data.py

# 启动服务
uvicorn app.main:app --reload --port 8000
```

启动后访问 http://localhost:8000/docs 看 FastAPI 自动生成的 Swagger UI。

### 前端

```bash
cd apps/junior
npm install
npm run dev
```

开两个浏览器标签：
- A（小辈）:`http://localhost:5174/`
- B（长辈）:`http://localhost:5174/?role=senior`

A 走完 筛图 → 预览 → 发送；B 自动收到日记并 TTS 朗读，按红色按钮提问。

> 目前前端 `BASE_URL` 写死在 [apps/junior/src/api/data.ts](apps/junior/src/api/data.ts) 等文件里。如果后端不在同一台机器，改成对应的内网 IP。

## 接口总览

详见 [backend/docs/接口文档.md](backend/docs/接口文档.md)。所有接口都是 `{ code, message, data }` 封装。

| Method | Path | 用途 | 触发点 |
|---|---|---|---|
| `GET` | `/api/v1/data/raw?date=&user_id=` | 拉取当日待筛素材 | 小辈进筛选页时 |
| `POST` | `/api/v1/data/raw/delete` | 软删除选中的素材 (status='deleted') | 上滑删除卡片时 |
| `POST` | `/api/v1/agent/generate-summary` | LLM 生成长辈友好家书 | 点"进入下一步"时 |
| `POST` | `/api/v1/agent/chat` | 长辈语音提问 → AI 回答 / 触发关怀通知 | 长辈端松开"说话"按钮时 |
| `GET` | `/api/v1/messages?user_id=` | 获取长辈关怀留言列表 | 小辈进留言页时 |

## Demo 流程

```
┌─ 小辈端 ────────────────────────┐
│ 1. GET /data/raw  →  待筛卡片  │
│ 2. 上滑删 / 左右滑留           │
│    每次上滑 → POST /raw/delete  │
│ 3. 点"进入下一步"              │
│    → POST /agent/generate-summary│
│    → 拿到 title / content /     │
│       cover_image[] /            │
│       suggested_questions[]      │
│ 4. 预览页 → 点"发送给妈妈"     │
└──────────────┬──────────────────┘
               │
               ▼
┌─ 长辈端 ────────────────────────┐
│ 5. 收到 diary → 云 TTS 朗读     │
│ 6. 字幕跟随当前句高亮            │
│ 7. 点麦克风 → 浏览器/腾讯云 ASR  │
│    → POST /agent/chat            │
│    → reply_text 给 TTS 接着念    │
│    → action=notify_younger 时    │
│      后端写入 messages 表        │
└──────────────┬──────────────────┘
               │
               ▼
┌─ 小辈收到通知 ──────────────────┐
│ 8. GET /messages → 红点提示      │
│    "妈妈想你了，问你吃饭没"      │
└─────────────────────────────────┘
```

## 技术栈

**前端**
- React 18 + Vite 5 + TypeScript + Tailwind v3
- 筛图手势：`@use-gesture/react` + `@react-spring/web`
- 语音识别 ASR：腾讯云实时语音识别 (`tencentcloud-speech-sdk-js`)
- 语音合成 TTS：腾讯云实时语音合成 WebSocket (智瑜女声 `101001`)

**后端**
- FastAPI + Uvicorn
- SQLAlchemy 2.0 + SQLite (零部署)
- OpenAI GPT-4o (生成日记 / 对话 / 留言传达三大场景)
- Pydantic-settings 管理 `.env`

**数据存储**（SQLite，3 张核心表）
- `raw_data` — 待筛素材，状态 `pending` / `deleted` / `processed`
- `diaries` — 已生成家书，含 `summary_id`、`cover_image`、`suggested_questions`
- `messages` — 长辈关怀留言，未读状态 `is_transferred=false`

详见 [backend/docs/后端技术方案.md](backend/docs/后端技术方案.md)。

## 已知约束

- 单家庭、无注册：`user_id` 直接传字符串，没有 JWT
- LLM 同步调用，约 2-5s，前端用"AI 正在写小作文…"动画掩盖
- 长辈端 TTS / ASR 都依赖网络，断网则降级失败
- 腾讯云语音密钥目前在前端 `.env.local`，仅 demo 用，**生产必须走后端 STS**
