# AI 家庭日记 实施计划（24h 黑客松 · 3 人并行）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 24 小时内交付一个可现场演示的代际沟通 Web 产品：小辈戴 Insta360 → AI 自动生成家书 → 长辈端语音朗读 + 语音提问/留言。

**Architecture:** 前后端分离；后端 Node/Express + SQLite 单进程；核心 Agent 层用 Claude Sonnet 4.6 做视觉描述、日记合成、问答、意图判定；长辈端用浏览器 SpeechRecognition + 云 TTS 做语音闭环。

**Tech Stack:** Node.js 20 · Express · better-sqlite3 · FFmpeg · Anthropic SDK · React 18 · Vite · Tailwind · Vitest · 火山引擎 TTS · Chrome SpeechRecognition API

**计划形态（C 方案）：**
- **关键路径任务（1–7）** 用 TDD 细粒度（红-绿-提交，含完整代码），防翻车
- **并行执行轨道（Track A/B/C）** 用 checklist 粗粒度（30–90 分钟一块），3 人抢时间
- **联调 & 彩排节点** 硬约束时间点

**仓库结构：**
```
nankesong/
├── backend/
│   ├── src/
│   │   ├── db.js              # SQLite 初始化 + schema
│   │   ├── server.js          # Express 入口
│   │   ├── routes/            # 各 API 路由
│   │   ├── agent/             # LLM 调用封装
│   │   ├── pipeline/          # 抽帧 + 视觉描述
│   │   └── services/          # TTS / ASR 意图判定
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── junior/            # 小辈端页面
│   │   ├── senior/            # 长辈端页面
│   │   ├── shared/            # 公共组件
│   │   └── api.js             # axios 封装
│   └── package.json
├── mock-data/
│   └── social-posts.json      # mock 社媒数据
└── scripts/
    └── seed.js                # demo 数据种子

```
---

## 第一部分：关键路径任务（TDD 细粒度）

这些任务是 demo 的"命门"，必须每步有代码有测试有验证。**由全栈队员线性执行**，其他人等它们的产出（API 契约、schema）开始并行任务。

---

### Task 1: 后端骨架 + SQLite schema

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/db.js`
- Create: `backend/src/server.js`
- Create: `backend/tests/db.test.js`

- [ ] **Step 1.1: 初始化后端项目**

```bash
cd backend
npm init -y
npm i express better-sqlite3 cors dotenv
npm i -D vitest supertest
```

编辑 `backend/package.json`，加 scripts + `"type": "module"`：

```json
{
  "type": "module",
  "scripts": {
    "dev": "node src/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 1.2: 写 schema 测试（应失败）**

Create `backend/tests/db.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '../src/db.js';

describe('db schema', () => {
  let db;
  beforeEach(() => {
    db = initDb(':memory:');
  });

  it('创建 6 张表', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all().map(r => r.name);
    expect(tables).toEqual([
      'comments', 'diaries', 'family', 'qa_logs', 'raw_clips', 'users'
    ]);
  });

  it('raw_clips.visibility 默认 visible', () => {
    db.prepare("INSERT INTO raw_clips (source, file_path, captured_at) VALUES (?, ?, ?)")
      .run('camera', '/tmp/x.mp4', Date.now());
    const row = db.prepare("SELECT visibility FROM raw_clips").get();
    expect(row.visibility).toBe('visible');
  });

  it('diaries.status 默认 draft', () => {
    db.prepare("INSERT INTO diaries (family_id, date, title, body_json, cover_images_json) VALUES (?, ?, ?, ?, ?)")
      .run(1, '2026-05-02', 't', '[]', '[]');
    const row = db.prepare("SELECT status FROM diaries").get();
    expect(row.status).toBe('draft');
  });
});
```

- [ ] **Step 1.3: 跑测试确认失败**

```bash
npm test
```

Expected: FAIL，`initDb` 未定义。

- [ ] **Step 1.4: 实现 db.js**

Create `backend/src/db.js`:

```javascript
import Database from 'better-sqlite3';

export function initDb(path = 'data.db') {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT CHECK(role IN ('senior','junior')) NOT NULL,
      name TEXT NOT NULL,
      family_id INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS family (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      junior_user_id INTEGER,
      senior_user_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS raw_clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT CHECK(source IN ('camera','social')) NOT NULL,
      file_path TEXT NOT NULL,
      captured_at INTEGER NOT NULL,
      auto_caption TEXT,
      visibility TEXT CHECK(visibility IN ('visible','hidden')) NOT NULL DEFAULT 'visible',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    );
    CREATE TABLE IF NOT EXISTS diaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT CHECK(status IN ('draft','published')) NOT NULL DEFAULT 'draft',
      title TEXT NOT NULL,
      body_json TEXT NOT NULL,
      cover_images_json TEXT NOT NULL,
      published_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diary_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      audio_url TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    );
    CREATE TABLE IF NOT EXISTS qa_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diary_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
    );
  `);

  return db;
}
```

- [ ] **Step 1.5: 跑测试确认通过**

```bash
npm test
```

Expected: 3 passing。

- [ ] **Step 1.6: 搭 Express 入口**

Create `backend/src/server.js`:

```javascript
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { initDb } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

export const db = initDb(process.env.DB_PATH || 'data.db');

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`API on :${PORT}`));
}

export default app;
```

- [ ] **Step 1.7: 提交**

```bash
git add backend/
git commit -m "feat(backend): add sqlite schema and express skeleton"
```

---
### Task 2: POST /ingest/clip + FFmpeg 抽帧

**Files:**
- Create: `backend/src/routes/ingest.js`
- Create: `backend/src/pipeline/extractFrames.js`
- Create: `backend/tests/ingest.test.js`
- Modify: `backend/src/server.js`

**前置：** `ffmpeg -version` 必须可用。

- [ ] **Step 2.1: 写路由测试（应失败）**

```javascript
// backend/tests/ingest.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app, { db } from '../src/server.js';

describe('POST /ingest/clip', () => {
  beforeEach(() => { db.exec('DELETE FROM raw_clips'); });

  it('写入 raw_clips，返回 id', async () => {
    const res = await request(app).post('/ingest/clip')
      .send({ file_path: '/tmp/demo.mp4', captured_at: 1714608000000 });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeGreaterThan(0);
    const row = db.prepare('SELECT * FROM raw_clips WHERE id=?').get(res.body.id);
    expect(row.source).toBe('camera');
    expect(row.visibility).toBe('visible');
  });

  it('缺字段返回 400', async () => {
    const res = await request(app).post('/ingest/clip').send({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2.2: 跑测试确认失败** — `npm test -- ingest` → 404
- [ ] **Step 2.3: 实现路由**

```javascript
// backend/src/routes/ingest.js
import { Router } from 'express';
import { db } from '../server.js';

const router = Router();

router.post('/clip', (req, res) => {
  const { file_path, captured_at } = req.body;
  if (!file_path || !captured_at) return res.status(400).json({ error: 'file_path and captured_at required' });
  const { lastInsertRowid } = db.prepare(
    "INSERT INTO raw_clips (source, file_path, captured_at) VALUES ('camera', ?, ?)"
  ).run(file_path, captured_at);
  res.json({ id: lastInsertRowid });
});

router.post('/social', (req, res) => {
  const { content, captured_at } = req.body;
  if (!content || !captured_at) return res.status(400).json({ error: 'content and captured_at required' });
  const { lastInsertRowid } = db.prepare(
    "INSERT INTO raw_clips (source, file_path, captured_at, auto_caption) VALUES ('social', '(post)', ?, ?)"
  ).run(captured_at, content);
  res.json({ id: lastInsertRowid });
});

export default router;
```

在 `server.js` 加：

```javascript
import ingestRouter from './routes/ingest.js';
app.use('/ingest', ingestRouter);
```

- [ ] **Step 2.4: 跑测试确认通过** — `npm test -- ingest` → 2 passing
- [ ] **Step 2.5: 实现抽帧工具**

```javascript
// backend/src/pipeline/extractFrames.js
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

export async function extractFrames(videoPath, outDir, intervalSec = 3) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const base = basename(videoPath, extname(videoPath));
  const pattern = join(outDir, `${base}_%03d.jpg`);
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', videoPath, '-vf', `fps=1/${intervalSec}`, '-q:v', '2', pattern];
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    ff.stderr.on('data', d => stderr += d.toString());
    ff.on('close', code => {
      if (code !== 0) return reject(new Error(`ffmpeg failed: ${stderr}`));
      const frames = readdirSync(outDir).filter(f => f.startsWith(base + '_')).map(f => join(outDir, f));
      resolve(frames);
    });
  });
}
```

- [ ] **Step 2.6: 提交** — `git add backend/ && git commit -m "feat(backend): add /ingest routes and ffmpeg frame extractor"`

---
### Task 3: 视觉描述生成（Claude 多模态）

**Files:**
- Create: `backend/src/agent/describeFrame.js`
- Create: `backend/tests/fixtures/sample.jpg`（任意一张日常生活图）
- Create: `backend/tests/describeFrame.test.js`

**前置：** `ANTHROPIC_API_KEY` 已设；`npm i @anthropic-ai/sdk`。

- [ ] **Step 3.1: 放一张测试图** 到 `backend/tests/fixtures/sample.jpg`
- [ ] **Step 3.2: 写测试**

```javascript
// backend/tests/describeFrame.test.js
import { describe, it, expect } from 'vitest';
import { describeFrame } from '../src/agent/describeFrame.js';
import { readFileSync, existsSync } from 'node:fs';

describe('describeFrame', () => {
  it.skipIf(!process.env.ANTHROPIC_API_KEY)('返回非空中文描述', async () => {
    const imgPath = 'tests/fixtures/sample.jpg';
    if (!existsSync(imgPath)) throw new Error('put sample.jpg first');
    const caption = await describeFrame(readFileSync(imgPath));
    expect(caption).toBeTruthy();
    expect(caption.length).toBeGreaterThan(5);
    console.log('caption:', caption);
  }, 30000);
});
```

- [ ] **Step 3.3: 实现**

```javascript
// backend/src/agent/describeFrame.js
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

export async function describeFrame(imageBuffer) {
  const base64 = imageBuffer.toString('base64');
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: '用一句中文（15-30 字）客观描述这张图里发生的事、地点、心情线索。不要猜人名。' }
      ]
    }]
  });
  return resp.content[0].text.trim();
}
```

- [ ] **Step 3.4: 跑测试 + 人眼检查** — `npm test -- describeFrame`，读 console 的 caption，太机械就回 3.3 调 prompt
- [ ] **Step 3.5: 提交** — `git add backend/ && git commit -m "feat(agent): add claude vision frame description"`

---
### Task 4: 日记生成（核心魔法 · Few-shot）

**Files:**
- Create: `backend/src/agent/fewShots.js`
- Create: `backend/src/agent/generateDiary.js`
- Create: `backend/src/routes/diary.js`
- Create: `backend/tests/generateDiary.test.js`
- Modify: `backend/src/server.js`

- [ ] **Step 4.1: 手工编 3 篇 few-shot 日记**

```javascript
// backend/src/agent/fewShots.js
export const FEW_SHOT_DIARIES = [
  {
    clips: ['小区门口的早晨，梧桐透着阳光', '地铁上戴耳机看窗外', '公司楼下咖啡店一杯拿铁', '晚上和朋友在小吃街烤串摊'],
    title: '普通又温柔的一天',
    bodyParagraphs: [
      '今天小明一早就出门了，小区的梧桐又绿了一些。',
      '路上他戴着耳机，应该是听喜欢的歌。中午在公司楼下点了拿铁，看起来工作挺顺。',
      '晚上和两个朋友去了小吃街，烤串摊热闹得很，他笑得挺开心。',
      '今天是普通又温柔的一天。'
    ]
  },
  {
    clips: ['医院走廊', '诊室的电脑屏幕', '药房取药', '回到家的沙发'],
    title: '小检查，没事的',
    bodyParagraphs: [
      '今天小明去了趟医院，看起来是个小检查。',
      '候诊的时候挺安静的，诊室里医生边说边看片子。取完药就回家了。',
      '倒在沙发上像是累了。妈妈别担心，他回家就歇下了，看着精神还可以。'
    ]
  },
  {
    clips: ['公园的长椅', '黄白色流浪猫', '手里的书', '傍晚的夕阳'],
    title: '一个人的半天',
    bodyParagraphs: [
      '今天小明没上班，去公园待了半天。',
      '他坐在长椅上看书，旁边一只黄白色的流浪猫蹭过来，他掏出包里的饼干喂它。',
      '夕阳下山的时候他还在，书看了大半本。这种日子他需要。'
    ]
  }
];
```

- [ ] **Step 4.2: 写测试**

```javascript
// backend/tests/generateDiary.test.js
import { describe, it, expect } from 'vitest';
import { generateDiary } from '../src/agent/generateDiary.js';

describe('generateDiary', () => {
  it.skipIf(!process.env.ANTHROPIC_API_KEY)('生成温暖日记 JSON', async () => {
    const result = await generateDiary({
      juniorName: '小明',
      date: '2026-05-02',
      clipCaptions: ['三里屯春天午后的街边', '三人围坐火锅冒热气', '咖啡店对着笔记本工作', '夜晚回家街灯亮着']
    });
    expect(result.title).toBeTruthy();
    expect(Array.isArray(result.body)).toBe(true);
    expect(result.body.length).toBeGreaterThanOrEqual(2);
    expect(result.body.every(p => p.text && p.text.length > 5)).toBe(true);
    console.log(JSON.stringify(result, null, 2));
  }, 60000);
});
```

- [ ] **Step 4.3: 跑测试确认失败** — `npm test -- generateDiary`
- [ ] **Step 4.4: 实现**

```javascript
// backend/src/agent/generateDiary.js
import Anthropic from '@anthropic-ai/sdk';
import { FEW_SHOT_DIARIES } from './fewShots.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `你是一位家书写手。把"这一天发生的事"写成短短的日记，让家里的长辈能温柔地读到。

要求：
1. 第三人称，称呼用户提供的"小辈名字"
2. 3-5 段，每段 1-3 句话，段落之间有呼吸感
3. 不编造细节、不猜人名、只写 clip 描述能推断出的事
4. 语气：平静、有温度，像家人给家人写信。不煽情不矫情
5. 结尾可以给一句轻轻的收束
6. 严格输出 JSON：{"title":"...","body":[{"text":"..."},...]}`;

export async function generateDiary({ juniorName, date, clipCaptions }) {
  const fewShotMsgs = FEW_SHOT_DIARIES.flatMap(ex => ([
    { role: 'user', content: `小辈名字：小明\n日期：某日\nclip 描述：\n- ${ex.clips.join('\n- ')}` },
    { role: 'assistant', content: JSON.stringify({ title: ex.title, body: ex.bodyParagraphs.map(text => ({ text })) }) }
  ]));

  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [
      ...fewShotMsgs,
      { role: 'user', content: `小辈名字：${juniorName}\n日期：${date}\nclip 描述：\n- ${clipCaptions.join('\n- ')}` }
    ]
  });

  const text = resp.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`LLM 输出非 JSON: ${text}`);
  const parsed = JSON.parse(jsonMatch[0]);
  parsed.body = parsed.body.map((p, i) => ({ id: `p${i}`, ...p }));
  return parsed;
}
```

- [ ] **Step 4.5: 跑测试 + 读 console 输出**：日记生硬就回 4.1 调 few-shot 或 4.4 调 prompt。这步不要急。
- [ ] **Step 4.6: 实现 /diary 路由**

```javascript
// backend/src/routes/diary.js
import { Router } from 'express';
import { db } from '../server.js';
import { generateDiary } from '../agent/generateDiary.js';

const router = Router();

router.post('/generate', async (req, res) => {
  const { family_id, date } = req.body;
  if (!family_id || !date) return res.status(400).json({ error: 'family_id and date required' });

  const dayStart = new Date(date + 'T00:00:00').getTime();
  const dayEnd = dayStart + 86400000;

  const clips = db.prepare(
    `SELECT id, auto_caption FROM raw_clips WHERE visibility='visible' AND captured_at>=? AND captured_at<? AND auto_caption IS NOT NULL`
  ).all(dayStart, dayEnd);
  if (clips.length === 0) return res.status(400).json({ error: 'no visible clips for this date' });

  const junior = db.prepare(`SELECT name FROM users WHERE family_id=? AND role='junior'`).get(family_id);
  const diary = await generateDiary({
    juniorName: junior?.name || '小辈',
    date,
    clipCaptions: clips.map(c => c.auto_caption)
  });
  diary.body = diary.body.map(p => ({ ...p, source_clip_ids: clips.map(c => c.id) }));
  const cover = clips.slice(0, 4).map(c => `/clips/${c.id}/thumb.jpg`);

  const { lastInsertRowid } = db.prepare(
    `INSERT INTO diaries (family_id, date, title, body_json, cover_images_json) VALUES (?,?,?,?,?)`
  ).run(family_id, date, diary.title, JSON.stringify(diary.body), JSON.stringify(cover));

  res.json({ id: lastInsertRowid, title: diary.title, body: diary.body, cover_images: cover });
});

router.get('/today', (req, res) => {
  const { family_id, date, role } = req.query;
  const sql = role === 'senior'
    ? `SELECT * FROM diaries WHERE family_id=? AND date=? AND status='published' ORDER BY id DESC LIMIT 1`
    : `SELECT * FROM diaries WHERE family_id=? AND date=? ORDER BY id DESC LIMIT 1`;
  const row = db.prepare(sql).get(family_id, date);
  if (!row) return res.status(404).json({ error: 'no diary' });
  res.json({ ...row, body: JSON.parse(row.body_json), cover_images: JSON.parse(row.cover_images_json) });
});

router.patch('/:id', (req, res) => {
  const { title, body } = req.body;
  const updates = [], params = [];
  if (title !== undefined) { updates.push('title=?'); params.push(title); }
  if (body !== undefined) { updates.push('body_json=?'); params.push(JSON.stringify(body)); }
  if (updates.length === 0) return res.json({ ok: true });
  params.push(req.params.id);
  db.prepare(`UPDATE diaries SET ${updates.join(',')} WHERE id=?`).run(...params);
  res.json({ ok: true });
});

router.post('/:id/publish', (req, res) => {
  db.prepare(`UPDATE diaries SET status='published', published_at=? WHERE id=?`).run(Date.now(), req.params.id);
  res.json({ ok: true });
});

router.get('/history', (req, res) => {
  const { family_id } = req.query;
  const rows = db.prepare(
    `SELECT id, date, title, published_at FROM diaries WHERE family_id=? AND status='published' ORDER BY date DESC LIMIT 30`
  ).all(family_id);
  res.json({ items: rows });
});

export default router;
```

在 `server.js`：

```javascript
import diaryRouter from './routes/diary.js';
app.use('/diary', diaryRouter);
```

- [ ] **Step 4.7: Smoke 测试**

```bash
npm run dev &
sqlite3 backend/data.db < scripts/seed.sql
curl -X POST http://localhost:3000/diary/generate -H "Content-Type: application/json" -d '{"family_id":1,"date":"2026-05-02"}' | jq
```

Expected: 返回温暖中文日记 JSON。

- [ ] **Step 4.8: 提交** — `git add backend/ && git commit -m "feat(agent): diary generation with few-shot + /diary routes"`

---
### Task 5: TTS 服务封装（火山引擎）

**Files:**
- Create: `backend/src/services/tts.js`
- Create: `backend/src/routes/tts.js`
- Create: `backend/tests/tts.test.js`

**前置：** 火山引擎开通 TTS，`.env` 写入：

```
VOLC_TTS_APPID=xxx
VOLC_TTS_TOKEN=xxx
VOLC_TTS_CLUSTER=volcano_tts
VOLC_TTS_VOICE=BV700_streaming
```

- [ ] **Step 5.1: 写测试**

```javascript
// backend/tests/tts.test.js
import { describe, it, expect } from 'vitest';
import { synthesize } from '../src/services/tts.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

describe('TTS synthesize', () => {
  it.skipIf(!process.env.VOLC_TTS_TOKEN)('合成音频返回非空 Buffer', async () => {
    const audio = await synthesize('妈妈你好，这是今天小明的日记。');
    expect(Buffer.isBuffer(audio)).toBe(true);
    expect(audio.length).toBeGreaterThan(1000);
    if (!existsSync('tests/out')) mkdirSync('tests/out', { recursive: true });
    writeFileSync('tests/out/tts-sample.mp3', audio);
  }, 15000);
});
```

- [ ] **Step 5.2: 实现**

```javascript
// backend/src/services/tts.js
// 参考 https://www.volcengine.com/docs/6561/79817
const API = 'https://openspeech.bytedance.com/api/v1/tts';

export async function synthesize(text, options = {}) {
  const body = {
    app: {
      appid: process.env.VOLC_TTS_APPID,
      token: process.env.VOLC_TTS_TOKEN,
      cluster: process.env.VOLC_TTS_CLUSTER
    },
    user: { uid: 'family-diary' },
    audio: {
      voice_type: options.voice || process.env.VOLC_TTS_VOICE,
      encoding: 'mp3', speed_ratio: 1.0, volume_ratio: 1.0, pitch_ratio: 1.0
    },
    request: {
      reqid: crypto.randomUUID(), text, text_type: 'plain', operation: 'query'
    }
  };
  const resp = await fetch(API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer;${process.env.VOLC_TTS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`TTS HTTP ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  if (!json.data) throw new Error(`TTS error: ${JSON.stringify(json)}`);
  return Buffer.from(json.data, 'base64');
}
```

- [ ] **Step 5.3: 跑测试 + 播 mp3 验证音色** — `npm test -- tts`，播 `tests/out/tts-sample.mp3`，不喜欢换 `VOLC_TTS_VOICE`
- [ ] **Step 5.4: 暴露路由**

```javascript
// backend/src/routes/tts.js
import { Router } from 'express';
import { synthesize } from '../services/tts.js';

const router = Router();
router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const audio = await synthesize(text);
    res.set('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (e) {
    console.error('[tts]', e);
    res.status(500).json({ error: e.message });
  }
});
export default router;
```

在 `server.js`：

```javascript
import ttsRouter from './routes/tts.js';
app.use('/tts', ttsRouter);
```

- [ ] **Step 5.5: 提交** — `git add backend/ && git commit -m "feat(tts): volcengine tts service and /tts route"`

---
### Task 6: 意图判定 + 提问/留言端点

**Files:**
- Create: `backend/src/agent/classifyIntent.js`
- Create: `backend/src/agent/answerQuestion.js`
- Create: `backend/src/routes/interact.js`
- Create: `backend/tests/classifyIntent.test.js`

- [ ] **Step 6.1: 写测试**

```javascript
// backend/tests/classifyIntent.test.js
import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../src/agent/classifyIntent.js';

describe('classifyIntent', () => {
  it.skipIf(!process.env.ANTHROPIC_API_KEY)('识别提问', async () => {
    expect(await classifyIntent('他今天吃的什么火锅啊')).toBe('question');
  }, 15000);
  it.skipIf(!process.env.ANTHROPIC_API_KEY)('识别留言', async () => {
    expect(await classifyIntent('儿子，妈妈想你了')).toBe('message');
  }, 15000);
});
```

- [ ] **Step 6.2: 实现意图分类 + 问答**

```javascript
// backend/src/agent/classifyIntent.js
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

export async function classifyIntent(text) {
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 10,
    system: '判断输入是"提问"（想知道某事）还是"留言"（想让对方收到的话）。只输出一个词：question 或 message。',
    messages: [{ role: 'user', content: text }]
  });
  const out = resp.content[0].text.trim().toLowerCase();
  return out.includes('question') ? 'question' : 'message';
}
```

```javascript
// backend/src/agent/answerQuestion.js
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

export async function answerQuestion({ question, diary, clipCaptions }) {
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system: `你在帮一位长辈了解孩子今天发生的事。根据日记和原始素材描述，用 1-2 句温柔中文回答长辈的问题。不要编造。日记/素材里没提到的事就说"这个今天的日记里没提到，下次可以直接问他"。`,
    messages: [{
      role: 'user',
      content: `【今日日记】\n${diary}\n\n【原始素材】\n${clipCaptions.join('\n')}\n\n【长辈的问题】\n${question}`
    }]
  });
  return resp.content[0].text.trim();
}
```

- [ ] **Step 6.3: 跑测试** — `npm test -- classifyIntent` → 2 passing
- [ ] **Step 6.4: 实现 /diary/:id/ask + /comment**

```javascript
// backend/src/routes/interact.js
import { Router } from 'express';
import { db } from '../server.js';
import { answerQuestion } from '../agent/answerQuestion.js';

const router = Router({ mergeParams: true });

router.post('/:id/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });

  const diary = db.prepare(`SELECT body_json FROM diaries WHERE id=?`).get(req.params.id);
  if (!diary) return res.status(404).json({ error: 'diary not found' });

  const body = JSON.parse(diary.body_json);
  const diaryText = body.map(p => p.text).join('\n');
  const clipIds = [...new Set(body.flatMap(p => p.source_clip_ids || []))];
  const clipRows = clipIds.length
    ? db.prepare(`SELECT auto_caption FROM raw_clips WHERE id IN (${clipIds.map(() => '?').join(',')})`).all(...clipIds)
    : [];
  const clipCaptions = clipRows.map(r => r.auto_caption).filter(Boolean);

  const answer = await answerQuestion({ question, diary: diaryText, clipCaptions });
  db.prepare(`INSERT INTO qa_logs (diary_id, question, answer) VALUES (?,?,?)`).run(req.params.id, question, answer);
  res.json({ answer });
});

router.post('/:id/comment', (req, res) => {
  const { author_id, content, audio_url } = req.body;
  if (!author_id || !content) return res.status(400).json({ error: 'author_id and content required' });
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO comments (diary_id, author_id, content, audio_url) VALUES (?,?,?,?)`
  ).run(req.params.id, author_id, content, audio_url || null);
  res.json({ id: lastInsertRowid });
});

router.get('/:id/comments', (req, res) => {
  const rows = db.prepare(
    `SELECT c.*, u.name author_name FROM comments c
     LEFT JOIN users u ON u.id=c.author_id
     WHERE diary_id=? ORDER BY created_at ASC`
  ).all(req.params.id);
  res.json({ items: rows });
});

export default router;
```

在 `server.js`：

```javascript
import interactRouter from './routes/interact.js';
app.use('/diary', interactRouter);
```

- [ ] **Step 6.5: Smoke 测试**

```bash
curl -X POST http://localhost:3000/diary/1/ask -H "Content-Type: application/json" -d '{"question":"他今天吃的什么？"}'
```

Expected: 基于日记的温柔中文答案。

- [ ] **Step 6.6: 提交** — `git add backend/ && git commit -m "feat(agent): intent classification, Q&A, comment endpoints"`

---
### Task 7: 管线打包（抽帧 → 描述 → 存储）

**Files:**
- Create: `backend/src/pipeline/processClip.js`
- Modify: `backend/src/routes/ingest.js`

作用：接收视频后自动跑 抽帧 → 描述 → 写 auto_caption，使得 `/ingest/clip` 完就可被 `/diary/generate` 直接使用。

- [ ] **Step 7.1: 实现 processClip**

```javascript
// backend/src/pipeline/processClip.js
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractFrames } from './extractFrames.js';
import { describeFrame } from '../agent/describeFrame.js';
import { db } from '../server.js';

export async function processClip(clipId) {
  const clip = db.prepare(`SELECT * FROM raw_clips WHERE id=?`).get(clipId);
  if (!clip) throw new Error(`clip ${clipId} not found`);
  if (clip.source !== 'camera') return; // 社媒已有 caption

  const outDir = join(tmpdir(), `clip-${clipId}-frames`);
  const frames = await extractFrames(clip.file_path, outDir, 5);
  if (frames.length === 0) throw new Error('no frames extracted');

  const midFrame = frames[Math.floor(frames.length / 2)];
  const caption = await describeFrame(readFileSync(midFrame));
  db.prepare(`UPDATE raw_clips SET auto_caption=? WHERE id=?`).run(caption, clipId);
  return caption;
}
```

- [ ] **Step 7.2: /ingest/clip 异步触发 processClip**

修改 `backend/src/routes/ingest.js`：

```javascript
import { processClip } from '../pipeline/processClip.js';

router.post('/clip', (req, res) => {
  const { file_path, captured_at } = req.body;
  if (!file_path || !captured_at) return res.status(400).json({ error: 'file_path and captured_at required' });
  const { lastInsertRowid } = db.prepare(
    "INSERT INTO raw_clips (source, file_path, captured_at) VALUES ('camera', ?, ?)"
  ).run(file_path, captured_at);

  // 异步处理，错误只 log
  processClip(lastInsertRowid).catch(e => console.error('[processClip]', e));

  res.json({ id: lastInsertRowid });
});
```

- [ ] **Step 7.3: 端到端验证**

```bash
curl -X POST http://localhost:3000/ingest/clip -H "Content-Type: application/json" \
  -d "{\"file_path\":\"/tmp/test.mp4\",\"captured_at\":$(date +%s%3N)}"
sleep 10
sqlite3 backend/data.db "SELECT id, auto_caption FROM raw_clips ORDER BY id DESC LIMIT 1;"
```

Expected: auto_caption 有中文描述。

- [ ] **Step 7.4: 提交** — `git add backend/ && git commit -m "feat(pipeline): wire clip→frames→caption on ingest"`

---

## 第二部分：并行执行轨道（粗粒度 checklist）

**执行原则：** Task 1 的 API 契约 + schema 落定后（约 0–2h），三人并行开跑。每个 tick 30-90 分钟完成一个条目。**每跑完一个条目就 commit**。

---

### Track A：全栈（完成 Task 1-7 后继续）

- [ ] **A1. Mock 社媒数据 `mock-data/social-posts.json`** （5-8 条，时间戳当天，内容贴合硬件队员拍的素材）
- [ ] **A2. 写 `scripts/seed.sql`** — 插入 1 个 family、2 个 users、mock 社媒 posts（用 `sqlite3 data.db < scripts/seed.sql`）
- [ ] **A3. `scripts/load-social.js`** — 读 `mock-data/social-posts.json`，批量 POST 到 `/ingest/social`
- [ ] **A4. Prompt 调优 · Round 1** — 跑 3 次 /diary/generate，读输出，改 `fewShots.js` 或 system prompt，直到三次都像家书
- [ ] **A5. Prompt 调优 · Round 2** — 把 Insta360 真实素材丢进去跑一次完整管线，调最后一版 prompt
- [ ] **A6. 评论轮询端点优化** — `/diary/:id/comments` 加 `?since=timestamp` 查询，前端轮询用
- [ ] **A7. 补 GET /clips?date= 端点 + PATCH /clips/:id** — 前者用于可选展示"今日素材"（demo §0:30–1:00 用到），后者用于"事前把某段标 hidden"。代码骨架：

```javascript
// backend/src/routes/clips.js
import { Router } from 'express';
import { db } from '../server.js';
const router = Router();

router.get('/', (req, res) => {
  const { date } = req.query;
  const dayStart = new Date(date + 'T00:00:00').getTime();
  const dayEnd = dayStart + 86400000;
  const rows = db.prepare(
    `SELECT id, source, file_path, auto_caption, visibility, captured_at
     FROM raw_clips WHERE captured_at>=? AND captured_at<? ORDER BY captured_at`
  ).all(dayStart, dayEnd);
  res.json({ items: rows });
});

router.patch('/:id', (req, res) => {
  const { visibility } = req.body;
  if (!['visible', 'hidden'].includes(visibility)) return res.status(400).json({ error: 'bad visibility' });
  db.prepare(`UPDATE raw_clips SET visibility=? WHERE id=?`).run(visibility, req.params.id);
  res.json({ ok: true });
});

export default router;
```

在 `server.js` 挂：`import clipsRouter from './routes/clips.js'; app.use('/clips', clipsRouter);`

- [ ] **A8. 联调支持** — 见下方联调节点

### Track B：前端（从 0h 开始，不等后端）

**约定：** 后端 API 基地址 `http://localhost:3000`。前端 Vite devServer 反代 `/api` 到它。

- [ ] **B1. Vite + React 18 + Tailwind 初始化**

```bash
cd frontend
npm create vite@latest . -- --template react
npm i axios react-router-dom
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

在 `tailwind.config.js` 的 `content` 里加 `"./src/**/*.{js,jsx}"`。在 `src/index.css` 加 Tailwind 三指令。

- [ ] **B2. 路由 + api.js 封装**

```javascript
// frontend/src/api.js
import axios from 'axios';
const api = axios.create({ baseURL: '/api' });
export default api;
```

路由：`/junior`、`/senior`、`/`（重定向到一个选择页）。

- [ ] **B3. 小辈端审核页 `junior/DiaryReview.jsx`** — 按 spec 4.2 布局：倒计时条 + 段落卡片 + 删除按钮 + 封面格 + 发送按钮 + 底部妈妈留言
- [ ] **B4. 小辈端段落 PATCH 交互** — 删段/改字后调 `PATCH /diary/:id`
- [ ] **B5. 小辈端"立即发送"** — 调 `POST /diary/:id/publish`；倒计时归零自动调
- [ ] **B6. 小辈端新留言轮询小红点** — `GET /diary/:id/comments?since=…` 每 5s 轮询
- [ ] **B7. 长辈端阅读页 `senior/DiaryRead.jsx`** — 按 spec 4.1 布局：大字 + 封面 + 朗读进度 + 辅助按钮 + 底部红色"按住说话"
- [ ] **B8. 长辈端 TTS 播放控制** — 段落数组映射为"分段 TTS"：每段独立调 `POST /tts` 拿 audio/mpeg，用 `<audio>` 顺序播；当前段高亮 + 进度条
- [ ] **B9. 长辈端"按住说话"按钮**
  - 按下：`SpeechRecognition` 启动 + TTS `pause()`
  - 松开：录音结束，拿到 text → 调意图判定（临时用本地规则：含问号/"什么/怎么/几点"就是 question，否则 message）或调后端 classifyIntent
  - question → POST `/diary/:id/ask` → 拿 answer → 调 `/tts` 合成 → 播放
  - message → POST `/diary/:id/comment`（author_id=senior user id）
- [ ] **B10. 长辈端"太吵打字"备选** — 右下小按钮切换为 textarea + 发送
- [ ] **B11. 两端 UI 打磨** — 字号、留白、动画（发送成功 toast、朗读进度平滑）

### Track C：硬件 + 素材

- [ ] **C1. Insta360 SDK 接入** — 让视频能落到本地目录（如 `/tmp/clips/`），文件名含时间戳
- [ ] **C2. 白天拍素材** — 出门按"一天故事线"顺序拍 10-15 段（出门 / 通勤 / 午餐 / 工作 / 下班 / 晚饭 / 回家）；每段 30-60 秒
- [ ] **C3. 素材批量导入脚本 `scripts/import-clips.sh`**

```bash
#!/bin/bash
for f in /tmp/clips/*.mp4; do
  ts=$(date -r "$f" +%s%3N)
  curl -X POST http://localhost:3000/ingest/clip \
    -H "Content-Type: application/json" \
    -d "{\"file_path\":\"$f\",\"captured_at\":$ts}"
  sleep 1
done
```

- [ ] **C4. Mock 社媒内容撰写** — 和 A1 协作，写 5-8 条贴合当天素材的微博，时间穿插在 clip 之间
- [ ] **C5. 首次全链路联调支持** — 10h 联调点时在场，快速补素材
- [ ] **C6. 素材 Plan B** — 把"已处理完"的数据库 dump 成 `demo-backup.sql`，现场万一网络挂了 `sqlite3 data.db < demo-backup.sql` 秒恢复

---
## 第三部分：联调 & 彩排节点（硬约束）

### 🔹 10h 联调点（首次全链路）

**目标：** 硬件真拍的素材进 `/ingest/clip` → 自动跑 pipeline → `/diary/generate` → 小辈端显示草稿 → 点发布 → 长辈端阅读 + TTS 播报 + 按住说话留言 → 小辈端看到留言。

- [ ] 拍一段 1 分钟真实素材走完全流程
- [ ] 列出翻车点，分给 3 人立刻修
- [ ] 目标：能走通一次就算过；质感问题留后面打磨

### 🔹 14h UI 打磨 + 第二轮联调

- [ ] 长辈端字号/留白/红色按钮视觉终稿
- [ ] 小辈端倒计时 + 段落删除动画
- [ ] 用 10-15 段真实素材跑完整管线，评估日记质感
- [ ] prompt 最后一次调优

### 🔹 18h 彩排 1（按 5 分钟故事线完整跑一遍）

- [ ] 按 spec §12 故事线完整走一遍，计时
- [ ] 记录每个卡顿/翻车点
- [ ] Q&A 演练：评委可能问什么？准备 3 个回答

### 🔹 20h 彩排 2（修完 bug 再跑一遍）

- [ ] 全链路再跑 1 次
- [ ] 彩排用"新的真实素材"跑（防止只对预存数据工作）
- [ ] 测"麦克风权限"、"TTS API 可用"、"网络通"

### 🔹 22h Plan B 准备

- [ ] `demo-backup.sql` 已备好（素材 + auto_caption + 一篇生成好的日记都已入库）
- [ ] PPT 3 页：痛点 / 技术亮点 / 团队
- [ ] 演示脚本打印 1 份（主讲忘词用）
- [ ] 硬件队员睡 1 小时，主讲也别熬

---

## 第四部分：Demo 现场清单

**演示前 30 分钟：**
- [ ] Chrome localhost 麦克风权限已预授权
- [ ] 后端 `npm run dev` 已启动 + `/health` 返 200
- [ ] 种子数据已入库
- [ ] TTS API 可用（本地跑 `curl /tts -d '{"text":"测试"}'`）
- [ ] Insta360 + 数据线就绪（道具感）
- [ ] 两台显示器一屏小辈一屏长辈（或一台分屏）
- [ ] 备用：demo-backup.sql、预生成的日记 JSON、领夹麦

**演示中禁忌：**
- 不要真 Ctrl+C 服务器重启
- 不要临时改 prompt
- 不要讲超过 5 分钟
- 按住说话时**离麦远一点**，避免爆音

---

## 风险看板（照着 spec §10 每条打钩验证）

| 风险 | 预案是否已实施 | 负责人 |
|------|---------------|-------|
| TTS API 失败 | try/catch + 友好提示 | 全栈 |
| ASR 嘈杂失效 | 长辈端"打字备选"入口 + 领夹麦 | 前端 + 硬件 |
| 日记生成质感差 | few-shot 3 篇 + 保底日记 | 全栈 |
| Insta360 上传不稳 | demo 前已跑完全流程 | 硬件 |
| 麦克风权限弹窗 | Chrome 预授权 | 前端 |
| 时间不够 | 砍优先级：评论 → 重生成 → 段落删 → 历史 | 所有 |

---

## 附：约定总表

- **前端代理：** `frontend/vite.config.js` 加 `server.proxy`，把 `/api/*` 反代到 `http://localhost:3000/*`
- **后端端口：** 3000（固定）
- **数据库：** `backend/data.db`（单文件）
- **视频落盘：** `/tmp/clips/`
- **家庭 ID：** demo 用 `family_id=1`；小辈 `user_id=1`，长辈 `user_id=2`
- **Git commit 前缀：** `feat(backend) / feat(frontend) / feat(agent) / feat(tts) / feat(pipeline) / chore / fix`
- **禁止：** 任何 `git push --force`、`rm -rf`、跳过 hooks 的操作


