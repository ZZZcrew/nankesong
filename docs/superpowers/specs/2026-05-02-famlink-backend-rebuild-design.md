# FamLink 后端重建设计（对齐 PRD / 接口文档）

> 版本：v1.0
> 日期：2026-05-02
> 范围：后端（`backend/`），前端分支 `feature/frontend` 不变动

## 1. 背景与路线

`feat/backend` 分支当前落地的实现（clips / diaries / comments / OpenCV 视觉抽帧等 6 模型）与 `docs/产品需求文档.md`、`docs/接口文档.md`、`docs/后端技术方案.md` 描述的功能不一致。本设计决定**推倒现有 backend/，严格按 PRD + 接口文档 + 技术方案重建**。

**执行方式**：在 `feat/backend` 分支上先提交一次「清空 backend/」，再从 0 重建。旧实现保留在 git 历史中（`b44914e` 之前）作为参考。

前端分支 `feature/frontend`（6332fac ASR、筛选页、senior/junior 端）已按 PRD 那一套在做，本次后端重建后即可联调。

## 2. 目标与范围

### 2.1 功能范围
- **5 个接口**：`GET /data/raw`、`POST /data/raw/delete`、`POST /agent/generate-summary`、`POST /agent/chat`、`GET /messages`
- **3 张表**：`raw_data` / `diaries` / `messages`
- **Agent 三场景**：生成日记、长辈对话、留言传达
- **1 个 Mock 脚本**：7 条测试数据

### 2.2 非目标
- 鉴权（user_id 透传但不做任何校验）
- 向量记忆 / Mem0
- 异步队列
- Alembic 迁移
- 生产部署优化

## 3. 架构

### 3.1 分层职责

| 层 | 目录 | 职责 | 禁止 |
|----|------|------|------|
| 入口 | `app/main.py` | FastAPI 实例、CORS、路由挂载、启动时建表 | 写业务 |
| 配置 | `app/config.py` | `Settings` 读 `.env`：`OPENAI_API_KEY`、`BASE_URL`（可空）、`MODEL_NAME`（默认 `gpt-4o`）、`DATABASE_URL`（默认 `sqlite:///./data/famlink.db`） | 读业务数据 |
| DI | `app/deps.py` | `get_db`、`get_llm_client`、`get_agent` | 全局单例业务对象 |
| 数据层 | `app/models/` | SQLAlchemy 模型 + base.py（engine/SessionLocal/Base） | 查询逻辑 |
| Schema | `app/schemas/` | Pydantic 请求/响应 + `ApiResponse` 通用信封 | ORM 转换 |
| Prompt | `app/prompts/` | 三个 Prompt 模板字符串 + few-shot | 调 LLM |
| 服务 | `app/services/` | `LLMClient` Protocol + 实现；`FamLinkAgent` 三方法 | 碰 DB / HTTP |
| API | `app/api/` | 查 DB、调 Agent、落库、包 ApiResponse | 调 LLM / 写 Prompt |

### 3.2 目录结构

```
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── deps.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── raw_data.py
│   │   ├── diary.py
│   │   └── message.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── requests.py
│   │   └── responses.py
│   ├── prompts/
│   │   ├── __init__.py
│   │   ├── diary.py
│   │   ├── chat.py
│   │   └── transfer.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── llm_client.py
│   │   └── agent.py
│   └── api/
│       ├── __init__.py
│       ├── data.py
│       ├── agent.py
│       └── messages.py
├── scripts/
│   ├── init_db.py
│   └── mock_data.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_data_api.py
│   ├── test_agent_api.py
│   ├── test_messages_api.py
│   └── test_agent_service.py
├── data/
│   └── famlink.db          # 运行时生成，.gitignore
├── requirements.txt
├── .env.example
└── README.md
```

### 3.3 启动顺序

1. 加载 `.env` → 构造 `Settings`
2. 用 `Settings.DATABASE_URL` 建 engine
3. `Base.metadata.create_all(engine)` 建表（幂等）
4. 挂 CORS：`allow_origins=["*"]`、`allow_credentials=False`、`allow_methods=["*"]`、`allow_headers=["*"]`
5. 注册 3 个 router
6. Uvicorn 启动

## 4. 数据层

### 4.1 `raw_data`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTOINCREMENT | |
| item_id | VARCHAR(50) | UNIQUE NOT NULL | 格式 `raw_xxx` |
| type | VARCHAR(20) | NOT NULL | `image` / `video` / `text` |
| content | TEXT | NOT NULL | URL 或文本正文 |
| description | TEXT | 可空 | 原始配文 |
| status | VARCHAR(20) | DEFAULT `'pending'` | `pending` / `deleted` / `processed` |
| created_at | TIMESTAMP | DEFAULT `datetime.now` | |

### 4.2 `diaries`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | |
| summary_id | VARCHAR(50) | UNIQUE NOT NULL | 格式 `sum_xxx` |
| date | VARCHAR(10) | NOT NULL | `YYYY-MM-DD` 字符串 |
| title | VARCHAR(200) | NOT NULL | 15 字内 |
| content | TEXT | NOT NULL | 100-150 字 |
| cover_image | TEXT | 可空 | JSON 字符串 `["url",...]`（字段名**单数**） |
| suggested_questions | TEXT | 可空 | JSON 字符串 |
| raw_data_ids | TEXT | 可空 | JSON 字符串 |
| created_at | TIMESTAMP | DEFAULT `datetime.now` | |

### 4.3 `messages`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK | |
| summary_id | VARCHAR(50) | NOT NULL | 关联日记（不建外键） |
| elder_query | TEXT | NOT NULL | |
| agent_reply | TEXT | 可空 | |
| transfer_content | TEXT | 可空 | 20-30 字 |
| is_transferred | BOOLEAN | DEFAULT FALSE | 保留字段，本期**不翻转** |
| created_at | TIMESTAMP | DEFAULT `datetime.now` | |

### 4.4 基础设施（`models/base.py`）

- `engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})`
- `SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)`
- `Base = declarative_base()`
- 建表不在此处做，交给 `main.py` 启动钩子

### 4.5 JSON 字段策略

- **存**：API 层 `json.dumps(list)` 后赋给 ORM 字段
- **读**：API 层 `json.loads(field or "[]")`，`None`/空串都回 `[]`
- 不在 Model 里写自动 dumps/loads 的 property，保持调试透明

### 4.6 时间查询（半开区间）

```
start = datetime.strptime(date, "%Y-%m-%d")
end = start + timedelta(days=1)
filter(RawData.created_at >= start, RawData.created_at < end)
```

### 4.7 `summary_id` 生成

`sum_{uuid4().hex[:8]}`，避免技术方案原写法 `% 10000` 在同一秒内冲突（UNIQUE 约束会抛 IntegrityError）。

### 4.8 Mock 脚本（`scripts/mock_data.py`）

行为：
1. `Base.metadata.create_all(engine)` 建表（幂等）
2. 清空 `raw_data` 表
3. 插入下表 7 条，`created_at=datetime.now()`、`status='pending'`
4. `commit()` 并打印结果

| item_id | type | content | description |
|---------|------|---------|-------------|
| raw_001 | image | `https://picsum.photos/seed/hotpot/800/600` | 今天被 leader 骂了，怒吃一顿火锅 |
| raw_002 | text | 摔成狗了 | （空） |
| raw_003 | video | `https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4` | 周末骑行30公里，绝绝子 |
| raw_004 | image | `https://picsum.photos/seed/coffee/800/600` | 下午摸鱼喝了杯拿铁 |
| raw_005 | text | 今天emo了，想躺平 | （空） |
| raw_006 | image | `https://picsum.photos/seed/mountain/800/600` | 周末爬山，风景太美了 |
| raw_007 | image | `https://picsum.photos/seed/dinner/800/600` | 今天自己做了一顿晚餐 |

### 4.9 `.gitignore` 追加

```
data/*.db
.env
__pycache__/
.pytest_cache/
*.pyc
```

## 5. Agent 引擎与 Prompt

### 5.1 LLM 客户端（`services/llm_client.py`）

**Protocol**：

```python
class LLMClient(Protocol):
    def complete_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.7,
    ) -> dict: ...
```

- 强制 `response_format={"type":"json_object"}`
- 返回已解析 dict；解析失败抛 `LLMResponseError`

**生产实现 `OpenAICompatibleClient`**：
- 构造注入 `api_key`、`base_url`（可空）、`model`
- 用 `openai.OpenAI(api_key=..., base_url=...)`
- 内部 `client.chat.completions.create(model=..., messages=[...], temperature=..., response_format={"type":"json_object"})`
- `json.loads(response.choices[0].message.content)` + try/except

**测试实现 `FakeLLMClient`**：
- 构造传 `{scenario_key: fixed_response_dict}`
- `complete_json` 按 system 文本特征词路由：
  - `"家庭情感翻译官"` → diary
  - `"陪聊助手"` + elder_query 含"想"/"担心" → chat_notify，否则 chat_reply
  - `"留言翻译助手"` → transfer
- 记录调用次数和参数，供测试断言

### 5.2 `FamLinkAgent`（`services/agent.py`）

构造：`FamLinkAgent(llm: LLMClient)`。

#### 5.2.1 `generate_diary(raw_items: list[dict], date: str) -> dict`

1. `processed = self._preprocess_raw_data(raw_items)`
2. `items_text = self._format_items(processed)`
3. 填 `DIARY_PROMPT`（system 固定、user 填 `{date}` + `{items}`）
4. `result = self.llm.complete_json(system, user, temperature=0.7)`
5. 校验：`title`(str) / `content`(str) / `suggested_questions`(list) 必须存在，缺失抛 `AgentOutputError`
6. 补封面：从**原始 `raw_items`** 筛 `type in ("image","video")` 的 `content`，取前 3 个
7. 返回 `{title, content, cover_image, suggested_questions}`

> `summary_id` 不在此处生成，由 API 层负责。

#### 5.2.2 `chat_with_elder(diary_title, diary_content, elder_query) -> dict`

1. 填 `CHAT_PROMPT`
2. `complete_json(..., temperature=0.8)`
3. 校验：`reply_text`(str) + `action` ∈ {`"reply"`, `"notify_younger"`}；非法值回退 `"reply"` 并记 warning
4. 返回 `{reply_text, action, emotion_type?}`

#### 5.2.3 `transfer_message(summary_id, elder_query, agent_reply) -> dict`

1. 填 `TRANSFER_PROMPT`
2. `complete_json(..., temperature=0.7)`
3. 校验：`transfer_content`(str，超 40 字软截断) + `emotion_type`(str)
4. 返回 `{transfer_content, emotion_type, suggested_reply}`

#### 5.2.4 `_preprocess_raw_data(items)`

**只做流行语机械替换**，敏感信息柔化交给 Prompt（避免双重处理把句子打残）。

`SLANG_MAP`：

```
emo → 心情有点低落
躺平 → 休息放松
PUA → 工作遇到挑战
绝绝子 → 很棒
社畜 → 工作努力
摸鱼 → 休息放松
摔成狗了 → 有点小意外
leader → 领导
```

- `text` 类型：替换 `content` → 写入 `processed_text`
- `image` / `video` 类型：替换 `description` → 写入 `processed_text`，`content`（URL）原样
- 返回 `[{type, content, description, processed_text}, ...]`

#### 5.2.5 `_format_items(processed)`

- text：`文字动态: {processed_text}`
- image：`图片配文: {processed_text}`
- video：`视频配文: {processed_text}`
- 空 `processed_text` 用 `（无配文）`
- 用 `\n` 连接

### 5.3 Prompt 模板

每个文件导出 `SYSTEM` 和 `USER_TEMPLATE` 两个字符串常量。

#### 5.3.1 `prompts/diary.py`

**SYSTEM**（骨架）：

```
你是 FamLink 的家庭情感翻译官。任务：把年轻人的日常碎片
转化为长辈能理解、愿意看、感到温暖的"家书"。

转化规则：
1. 负面情绪 → 积极但真实（不遮掩也不放大）
   - "被PUA/被骂" → "工作遇到挑战"
   - "摔成狗了" → "有点小意外，已经没事了"
   - "崩溃/emo" → "心情有点波动，已经调整好"
2. 网络用语 → 长辈能懂
   - "绝绝子"→"很棒"、"摸鱼"→"间隙休息"、"躺平"→"放松"
3. 敏感信息过滤：不要出现工资/薪资/具体公司名
4. 保留：美食、运动、户外、学习、生活小事

输出要求：
- title：15 字内，温馨、点题
- content：100-150 字，开头"爸妈，"，结尾"你们放心吧，我很好"
- suggested_questions：2-3 个，长辈自然会问、能引导互动

严格输出 JSON：
{"title":"...","content":"...","suggested_questions":["...","..."]}
```

**USER_TEMPLATE**：

```
日期: {date}

今日碎片:
{items}

请生成今日家书。
```

#### 5.3.2 `prompts/chat.py`

**SYSTEM**（骨架）：

```
你是 FamLink 的长辈陪聊助手，帮长辈理解子女近况、回应长辈关心。

回答原则：
- 称呼从"奶奶/爷爷您好"开始
- 温和、耐心、长辈视角
- 基于提供的日记上下文，不要编造日记外的细节
- 强调子女的积极状态

action 判断（关键）：
- reply：一般询问（吃什么、和谁、风景、天气……）→ 直接答
- notify_younger：长辈表达以下任一情绪 → 触发通知
  * 想念（"想他了"、"好久没见"）
  * 担忧（"担心"、"最近还好吗"、"健康"、"安全"）
  * 嘱托（"让他多注意"、"告诉他……"）

严格输出 JSON：
{"reply_text":"...","action":"reply 或 notify_younger","emotion_type":"好奇|关心|担忧|欣慰|想念"}

示例 1（reply）：
输入：看着真香，这是和谁一起吃的呀？
输出：{"reply_text":"奶奶您好！照片里小明是和同事一起聚餐呢，大家看起来很开心。小明最近状态不错，您别担心。","action":"reply","emotion_type":"好奇"}

示例 2（notify_younger）：
输入：好久没见他了，想他了，不知道吃饭没
输出：{"reply_text":"奶奶，小明看到您的留言会很开心的。我会帮您转告他。","action":"notify_younger","emotion_type":"想念"}
```

**USER_TEMPLATE**：

```
【今日家书】
标题：{diary_title}
正文：{diary_content}

【长辈的提问】
{elder_query}
```

#### 5.3.3 `prompts/transfer.py`

**SYSTEM**（骨架）：

```
你是 FamLink 的留言翻译助手。任务：把长辈的关心留言
提炼成简洁通知给小辈。

规则：
- transfer_content：20-30 字，简洁有温度
  * 示例："奶奶想你了，问你吃饭没"
  * 示例："爷爷叮嘱你降温多穿衣"
- emotion_type：从 [关心, 担忧, 欣慰, 想念] 中选一个
- suggested_reply：15-25 字，给小辈一个轻松的回话模板

严格输出 JSON：
{"transfer_content":"...","emotion_type":"...","suggested_reply":"..."}
```

**USER_TEMPLATE**：

```
长辈留言：{elder_query}
Agent 刚才回复长辈：{agent_reply}
```

### 5.4 异常处理

- `LLMResponseError`：LLM 返回非合法 JSON → API 层捕获 → 500 `{code:500, message:"Agent 服务异常，请重试"}`
- `AgentOutputError`：JSON 合法但缺字段 → 同上
- LLM 超时/网络错误：不重试，冒泡为 500

## 6. API 层

### 6.1 通用信封（`schemas/responses.py`）

```python
class ApiResponse(BaseModel, Generic[T]):
    code: int = 200
    message: str = "success"
    data: T | None = None
```

所有接口返回 Pydantic 模型，不直接 return dict。

**错误响应也统一走 `ApiResponse` 信封**：不抛 `HTTPException`，而是直接构造 `ApiResponse(code=4xx/5xx, message="...", data=None)` 并用 `JSONResponse(status_code=200, content=...)` 返回（HTTP 状态固定 200，业务状态靠 `code` 字段——这样前端统一解析）。若偏好"HTTP 状态码 = 业务状态码"，则用 `JSONResponse(status_code=code, content=...)`。本期采用后者：**HTTP 状态 = code 字段**。

### 6.2 全局异常处理器（`main.py`）

- `AgentOutputError` / `LLMResponseError` → 500
- `ValidationError` → 422（FastAPI 默认）
- 其余 `Exception` → 500，`{code:500, message:str(e)}`（演示环境透出）

### 6.3 路由组织

```
/api/v1/data            → api/data.py::router
  GET  /raw
  POST /raw/delete

/api/v1/agent           → api/agent.py::router
  POST /generate-summary
  POST /chat

/api/v1                 → api/messages.py::router
  GET  /messages
```

`main.py`：

```python
app.include_router(data.router, prefix="/api/v1/data", tags=["data"])
app.include_router(agent.router, prefix="/api/v1/agent", tags=["agent"])
app.include_router(messages.router, prefix="/api/v1", tags=["messages"])
```

### 6.4 接口 1：`GET /api/v1/data/raw`

**请求**：Query `date: str`（必填）、`user_id: str | None`（接受但不使用）

**响应 data**：

```python
class RawItem(BaseModel):
    item_id: str
    type: Literal["image","video","text"]
    content: str
    description: str | None
    timestamp: str  # Unix 秒（字符串）

class RawListData(BaseModel):
    date: str
    items: list[RawItem]
```

**流程**：
1. 解析 date → `start`, `end = start + timedelta(days=1)`
2. `db.query(RawData).filter(status=='pending', created_at>=start, created_at<end).order_by(created_at).all()`
3. 转成 `RawItem(timestamp=str(int(created_at.timestamp())))`
4. 包 `ApiResponse[RawListData]`

**边界**：日期格式错 → 400 `{code:400, message:"日期格式错误，应为 YYYY-MM-DD"}`。

### 6.5 接口 2：`POST /api/v1/data/raw/delete`

**请求 body**：

```python
class DeleteRequest(BaseModel):
    item_ids: list[str]
    user_id: str
```

**响应 data**：`{deleted_count: int}`

**流程**：
1. `hits = db.query(RawData).filter(item_id.in_(request.item_ids), status=='pending').all()`（**加 status='pending' 过滤**，不重复计数已删/已处理）
2. 遍历改 `status='deleted'`
3. `commit()`
4. 返回 `{"code":200, "message":f"成功删除 {len(hits)} 条数据", "data":{"deleted_count":len(hits)}}`

**边界**：`item_ids=[]` → `deleted_count=0`。

### 6.6 接口 3：`POST /api/v1/agent/generate-summary`

**请求 body**：`{date: str, user_id: str}`

**响应 data**：

```python
class DiaryData(BaseModel):
    summary_id: str
    title: str
    content: str
    cover_image: list[str]          # 单数形式
    suggested_questions: list[str]
```

**流程**：
1. 解析 date → `start, end`
2. 查 `status='pending'` 的数据
3. 空列表 → 400 `{code:400, message:"当日没有可处理的数据"}`
4. 转 Agent dict 列表 `[{type, content, description}, ...]`
5. `result = agent.generate_diary(raw_items, date)`
6. `summary_id = f"sum_{uuid4().hex[:8]}"`
7. 写 `Diary`，cover_image / suggested_questions / raw_data_ids 用 `json.dumps`
8. 这批 raw_data 的 status 改 `'processed'`
9. `commit()`
10. 返回 `ApiResponse[DiaryData]`（响应里 cover_image 是 list）

**幂等性**：不做。同一天第二次点击会因第 3 步返回 400（pending 已空），天然挡住。

### 6.7 接口 4：`POST /api/v1/agent/chat`

**请求 body**：`{query: str, summary_id: str}`

**响应 data**：

```python
class ChatReplyData(BaseModel):
    reply_text: str
    action: Literal["reply","notify_younger"]
    transfer_content: str | None = None   # 仅 notify_younger 有
```

**流程**：
1. `diary = db.query(Diary).filter_by(summary_id=...).first()`
2. 不存在 → 404 `{code:404, message:"日记不存在"}`
3. `chat_result = agent.chat_with_elder(diary_title, diary_content, query)`
4. `action == "reply"`：直接返回
5. `action == "notify_younger"`：
   - `transfer_result = agent.transfer_message(summary_id, query, chat_result["reply_text"])`
   - 写 `Message`，`is_transferred=False`
   - `commit()`
   - 返回带 `transfer_content`

两次 LLM 总耗时预估 3-6 秒，前端需 loading 动画。

### 6.8 接口 5：`GET /api/v1/messages`

**请求**：Query `user_id: str | None`（接受但不使用）

**响应 data**：

```python
class MessageItem(BaseModel):
    summary_id: str
    transfer_content: str
    created_at: str    # ISO format

class MessageListData(BaseModel):
    messages: list[MessageItem]
```

**流程**：
1. `db.query(Message).order_by(created_at.desc()).all()`
2. 不过滤 `is_transferred`（只读策略）
3. 包 `ApiResponse[MessageListData]`

### 6.9 CORS

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # 用 * 时必须关
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 6.10 健康检查

`GET /health` → `{"status":"ok"}`

## 7. 测试策略

### 7.1 分层

| 层 | 文件 | 范围 | LLM |
|----|------|------|-----|
| API 集成 | `test_data_api.py` / `test_agent_api.py` / `test_messages_api.py` | 5 个接口的 TestClient 测试 | `FakeLLMClient` |
| Agent 服务 | `test_agent_service.py` | 预处理、格式化、三方法校验 | `FakeLLMClient` |
| 不写 | Model / schema / deps | 间接覆盖 | — |

覆盖率目标：关键路径覆盖；预期实际 70-85%。

### 7.2 Fixtures（`tests/conftest.py`）

```python
@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    yield session
    session.close()

@pytest.fixture
def fake_llm():
    return FakeLLMClient(responses={
        "diary": {"title":"今天吃火锅","content":"爸妈，我今天...","suggested_questions":["..."]},
        "chat_reply": {"reply_text":"奶奶您好...","action":"reply","emotion_type":"好奇"},
        "chat_notify": {"reply_text":"...会转告...","action":"notify_younger","emotion_type":"想念"},
        "transfer": {"transfer_content":"奶奶想你了","emotion_type":"想念","suggested_reply":"周末去看您"},
    })

@pytest.fixture
def client(db_session, fake_llm):
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_agent] = lambda: FamLinkAgent(fake_llm)
    yield TestClient(app)
    app.dependency_overrides.clear()

@pytest.fixture
def seed_raw_data(db_session):
    # 塞 3 条 pending raw_data，日期=今天
    ...
```

### 7.3 用例清单

**`test_data_api.py`**（6 个）：
1. `GET /data/raw` 返回当天 pending，不含 deleted
2. `GET /data/raw` 日期格式错 → 400
3. `GET /data/raw` 空数据 → `items: []`
4. `POST /data/raw/delete` 批量软删除
5. `POST /data/raw/delete` 重复删同一 id → count=1
6. `POST /data/raw/delete` 空 `item_ids` → count=0

**`test_agent_api.py`**（6 个）：
1. `generate-summary` 正常路径：返回 summary_id、cover_image 是 list、raw_data 全变 processed
2. `generate-summary` 当日无 pending → 400
3. `generate-summary` 只取 image/video 做封面，text 跳过，前 3 为限
4. `chat` action=reply：返回 reply_text，不写 Message
5. `chat` action=notify_younger：带 transfer_content，DB 写了 Message
6. `chat` summary_id 不存在 → 404

**`test_messages_api.py`**（2 个）：
1. 按 created_at 倒序返回
2. 空表 → `messages: []`

**`test_agent_service.py`**（5 个）：
1. `_preprocess_raw_data` 替换 `emo`/`躺平`/`绝绝子`
2. `_preprocess_raw_data` text 改 content、image 改 description
3. `_format_items` 按 type 拼前缀
4. `generate_diary` 封面源自**原始** raw_items，text 跳过
5. `generate_diary` LLM 缺字段 → `AgentOutputError`

合计约 19 个用例。

## 8. 提交节奏

全部提交在 `feat/backend` 分支。

### 第 0 步：清场

```
chore(backend): reset backend/ for PRD-aligned rebuild
```
`git rm -r backend/`。

### 第 1-13 步

| # | commit | 产出 |
|---|--------|------|
| 1 | `feat(backend): scaffold FastAPI app with config and health` | `main.py`、`config.py`、`/health`、`requirements.txt`、`.env.example` |
| 2 | `feat(backend): add SQLAlchemy models and base` | `models/` 三张表 + `base.py` |
| 3 | `feat(backend): add Pydantic schemas with ApiResponse envelope` | `schemas/` |
| 4 | `feat(backend): add LLMClient protocol and OpenAI-compatible impl` | `services/llm_client.py` |
| 5 | `test(backend): add FakeLLMClient and shared fixtures` | `tests/conftest.py` + FakeLLMClient |
| 6 | `feat(backend): add diary/chat/transfer prompts` | `prompts/` 三个文件 |
| 7 | `feat(backend): implement FamLinkAgent with three scenarios` | `services/agent.py` + `test_agent_service.py`（TDD） |
| 8 | `feat(backend): implement data APIs` | `api/data.py` + `test_data_api.py` |
| 9 | `feat(backend): implement agent APIs` | `api/agent.py` + `test_agent_api.py` |
| 10 | `feat(backend): implement GET /messages` | `api/messages.py` + `test_messages_api.py` |
| 11 | `feat(backend): mock data generator script` | `scripts/mock_data.py` |
| 12 | `chore(backend): wire CORS and router registration` | `main.py` 的 include_router + CORS |
| 13 | `docs(backend): add README with run instructions` | 启动步骤（可选） |

### 时间预算

| 阶段 | 提交 | 耗时 |
|------|------|------|
| 清场 + 脚手架 | 0-3 | 1-1.5h |
| LLM + 测试基建 | 4-5 | 1h |
| Prompt + Agent | 6-7 | 2.5-3h |
| API + 集成测试 | 8-10 | 2.5-3h |
| Mock + CORS + README | 11-13 | 0.5-1h |
| **合计** | | **7.5-9.5h** |

## 9. 验收标准

- [ ] `uvicorn app.main:app --port 8000` 能起
- [ ] `python scripts/mock_data.py` 产出 7 条 raw_data
- [ ] `pytest` 全绿
- [ ] `curl` 打通 5 个接口，响应格式严格匹配 `docs/接口文档.md`
- [ ] `/docs` Swagger UI 可访问，所有接口 schema 完整
- [ ] 前端 `feature/frontend` 分支无需改动即可联调（CORS 开放）

## 10. 非本次范围

以下在本次重建中**不做**，留给后续迭代：

- 留言「标记已读」接口
- 用户鉴权体系
- 向量记忆 / Mem0
- 异步任务队列（Celery 等）
- 真实社交平台抓取（PRD 提到的 Insta360、小红书、朋友圈）
- 语音 ASR/TTS（已在前端 `feature/frontend` 分支处理）
- 数据库迁移工具（Alembic）
- 生产部署（Docker、HTTPS、鉴权网关）
