# FamLink 后端重建实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `feat/backend` 分支上推倒现有 backend/ 代码，按 `docs/后端技术方案.md` + `docs/接口文档.md` 重建 FastAPI 后端，提供 5 个接口（`/data/raw`、`/data/raw/delete`、`/agent/generate-summary`、`/agent/chat`、`/messages`）和 Agent 三大场景（生成日记、长辈对话、留言传达）。

**Architecture:** 分层单体 FastAPI：`models` (SQLAlchemy) / `schemas` (Pydantic) / `prompts` / `services` (LLMClient Protocol + FamLinkAgent) / `api`。LLM 通过 Protocol 抽象，生产用 OpenAI 兼容层（支持 BASE_URL），测试注入 FakeLLMClient。SQLite 单文件数据库，无鉴权，CORS 全开。

**Tech Stack:** Python 3.11+、FastAPI、SQLAlchemy 2.0、Pydantic 2、openai SDK 1.x、pytest、SQLite。

**Spec:** `docs/superpowers/specs/2026-05-02-famlink-backend-rebuild-design.md`

---

## 总览

- **分支**：`feat/backend`
- **提交数**：14（1 次清场 + 13 次重建）
- **测试用例**：约 19 个（6 data + 6 agent + 2 messages + 5 agent_service）
- **前置**：确认你在 `D:/PRODUCT/PRODUCT/nankesong` 目录、`feat/backend` 分支、工作区干净

执行前运行：

```bash
git -C D:/PRODUCT/PRODUCT/nankesong status
git -C D:/PRODUCT/PRODUCT/nankesong branch --show-current
```

期望：`working tree clean`、当前分支 `feat/backend`。

---

## Task 0: 清空 backend/（重建起点）

**Files:**
- Delete: `backend/` 目录下所有内容（若存在）

- [ ] **Step 1: 确认 backend 目录当前内容**

```bash
ls D:/PRODUCT/PRODUCT/nankesong/backend/ 2>/dev/null || echo "backend/ 不存在"
```

- [ ] **Step 2: 删除 backend/ 目录**

```bash
git -C D:/PRODUCT/PRODUCT/nankesong rm -rf backend/ 2>/dev/null || true
rm -rf D:/PRODUCT/PRODUCT/nankesong/backend
```

- [ ] **Step 3: 确认删除**

```bash
ls D:/PRODUCT/PRODUCT/nankesong/backend/ 2>/dev/null
git -C D:/PRODUCT/PRODUCT/nankesong status
```

期望：backend/ 不存在；git status 显示大量 deleted 文件已 staged。

- [ ] **Step 4: Commit**

```bash
git -C D:/PRODUCT/PRODUCT/nankesong commit -m "$(cat <<'EOF'
chore(backend): reset backend/ for PRD-aligned rebuild

按 docs/后端技术方案.md + docs/接口文档.md 推倒重做。旧实现
（clips/diaries/OpenCV 方案）保留于 git 历史（b44914e 及之前）。
EOF
)"
```

---

## Task 1: 脚手架 + 配置 + health 检查

**Files:**
- Create: `backend/app/__init__.py`（空）
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/data/.gitkeep`

- [ ] **Step 1: 创建目录与空 __init__.py**

```bash
mkdir -p D:/PRODUCT/PRODUCT/nankesong/backend/app
mkdir -p D:/PRODUCT/PRODUCT/nankesong/backend/data
touch D:/PRODUCT/PRODUCT/nankesong/backend/app/__init__.py
touch D:/PRODUCT/PRODUCT/nankesong/backend/data/.gitkeep
```

- [ ] **Step 2: 写 `backend/requirements.txt`**

```
fastapi==0.109.2
uvicorn[standard]==0.27.1
sqlalchemy==2.0.25
openai==1.12.0
pydantic==2.6.1
pydantic-settings==2.1.0
python-multipart==0.0.9
python-dotenv==1.0.1
pytest==8.0.0
httpx==0.27.0
```

（`httpx` 给 FastAPI TestClient 用。）

- [ ] **Step 3: 写 `backend/.env.example`**

```
OPENAI_API_KEY=sk-xxxxx
BASE_URL=
MODEL_NAME=gpt-4o
DATABASE_URL=sqlite:///./data/famlink.db
```

- [ ] **Step 4: 写 `backend/.gitignore`**

```
__pycache__/
*.pyc
.pytest_cache/
.env
data/*.db
```

- [ ] **Step 5: 写 `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    OPENAI_API_KEY: str = "sk-placeholder"
    BASE_URL: str | None = None
    MODEL_NAME: str = "gpt-4o"
    DATABASE_URL: str = "sqlite:///./data/famlink.db"


settings = Settings()
```

- [ ] **Step 6: 写 `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="FamLink API",
    description="代际沟通 AI 助手 - 黑客松版",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: 启动验证**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && pip install -r requirements.txt
cd D:/PRODUCT/PRODUCT/nankesong/backend && python -c "from app.main import app; print('import ok')"
```

期望：`import ok`。

- [ ] **Step 8: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "feat(backend): scaffold FastAPI app with config and health"
```

---

## Task 2: SQLAlchemy 模型与 base

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/raw_data.py`
- Create: `backend/app/models/diary.py`
- Create: `backend/app/models/message.py`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p D:/PRODUCT/PRODUCT/nankesong/backend/app/models
touch D:/PRODUCT/PRODUCT/nankesong/backend/app/models/__init__.py
```

- [ ] **Step 2: 写 `backend/app/models/base.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```

- [ ] **Step 3: 写 `backend/app/models/raw_data.py`**

```python
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, TIMESTAMP

from app.models.base import Base


class RawData(Base):
    __tablename__ = "raw_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(String(50), unique=True, nullable=False)
    type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    description = Column(Text)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.now, nullable=False)
```

- [ ] **Step 4: 写 `backend/app/models/diary.py`**

```python
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, TIMESTAMP

from app.models.base import Base


class Diary(Base):
    __tablename__ = "diaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(String(50), unique=True, nullable=False)
    date = Column(String(10), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    cover_image = Column(Text)
    suggested_questions = Column(Text)
    raw_data_ids = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.now, nullable=False)
```

- [ ] **Step 5: 写 `backend/app/models/message.py`**

```python
from datetime import datetime

from sqlalchemy import Boolean, Column, Integer, String, Text, TIMESTAMP

from app.models.base import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(String(50), nullable=False)
    elder_query = Column(Text, nullable=False)
    agent_reply = Column(Text)
    transfer_content = Column(Text)
    is_transferred = Column(Boolean, default=False, nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.now, nullable=False)
```

- [ ] **Step 6: 更新 `backend/app/models/__init__.py`**

```python
from app.models.base import Base, SessionLocal, engine
from app.models.diary import Diary
from app.models.message import Message
from app.models.raw_data import RawData

__all__ = ["Base", "SessionLocal", "engine", "Diary", "Message", "RawData"]
```

- [ ] **Step 7: 在 `backend/app/main.py` 启动时建表**

修改 `backend/app/main.py`，在 `app = FastAPI(...)` 之后、`add_middleware` 之前插入：

```python
from app.models import Base, engine

Base.metadata.create_all(bind=engine)
```

最终 `main.py` 完整版：

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import Base, engine

app = FastAPI(
    title="FamLink API",
    description="代际沟通 AI 助手 - 黑客松版",
    version="1.0.0",
)

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 8: 验证建表**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && python -c "from app.main import app; print('tables created')"
ls D:/PRODUCT/PRODUCT/nankesong/backend/data/
```

期望：`tables created`；`data/` 下出现 `famlink.db`。

- [ ] **Step 9: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "feat(backend): add SQLAlchemy models and base"
```

---

## Task 3: Pydantic Schemas 与 ApiResponse 信封

**Files:**
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/responses.py`
- Create: `backend/app/schemas/requests.py`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p D:/PRODUCT/PRODUCT/nankesong/backend/app/schemas
touch D:/PRODUCT/PRODUCT/nankesong/backend/app/schemas/__init__.py
```

- [ ] **Step 2: 写 `backend/app/schemas/responses.py`**

```python
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = 200
    message: str = "success"
    data: T | None = None


class RawItem(BaseModel):
    item_id: str
    type: Literal["image", "video", "text"]
    content: str
    description: str | None = None
    timestamp: str


class RawListData(BaseModel):
    date: str
    items: list[RawItem]


class DeleteResultData(BaseModel):
    deleted_count: int


class DiaryData(BaseModel):
    summary_id: str
    title: str
    content: str
    cover_image: list[str]
    suggested_questions: list[str]


class ChatReplyData(BaseModel):
    reply_text: str
    action: Literal["reply", "notify_younger"]
    transfer_content: str | None = None


class MessageItem(BaseModel):
    summary_id: str
    transfer_content: str
    created_at: str


class MessageListData(BaseModel):
    messages: list[MessageItem]
```

- [ ] **Step 3: 写 `backend/app/schemas/requests.py`**

```python
from pydantic import BaseModel


class DeleteRequest(BaseModel):
    item_ids: list[str]
    user_id: str


class GenerateSummaryRequest(BaseModel):
    date: str
    user_id: str


class ChatRequest(BaseModel):
    query: str
    summary_id: str
```

- [ ] **Step 4: 验证 import**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && python -c "from app.schemas.responses import ApiResponse, DiaryData; from app.schemas.requests import ChatRequest; print('schemas ok')"
```

期望：`schemas ok`。

- [ ] **Step 5: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "feat(backend): add Pydantic schemas with ApiResponse envelope"
```

---

## Task 4: LLMClient Protocol 与 OpenAI 兼容实现

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/llm_client.py`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p D:/PRODUCT/PRODUCT/nankesong/backend/app/services
touch D:/PRODUCT/PRODUCT/nankesong/backend/app/services/__init__.py
```

- [ ] **Step 2: 写 `backend/app/services/llm_client.py`**

```python
import json
from typing import Protocol

from openai import OpenAI


class LLMResponseError(Exception):
    """LLM 返回的不是合法 JSON，或调用失败。"""


class LLMClient(Protocol):
    def complete_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.7,
    ) -> dict: ...


class OpenAICompatibleClient:
    def __init__(self, api_key: str, model: str, base_url: str | None = None):
        kwargs: dict = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = OpenAI(**kwargs)
        self._model = model

    def complete_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.7,
    ) -> dict:
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
                response_format={"type": "json_object"},
            )
        except Exception as e:
            raise LLMResponseError(f"LLM 调用失败: {e}") from e

        content = response.choices[0].message.content or ""
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise LLMResponseError(f"LLM 返回非 JSON: {content[:200]}") from e
```

- [ ] **Step 3: 验证 import**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && python -c "from app.services.llm_client import LLMClient, OpenAICompatibleClient, LLMResponseError; print('llm_client ok')"
```

期望：`llm_client ok`。

- [ ] **Step 4: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "feat(backend): add LLMClient protocol and OpenAI-compatible impl"
```

---

## Task 5: 测试基建（FakeLLMClient + conftest）

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/fake_llm.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/app/deps.py`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p D:/PRODUCT/PRODUCT/nankesong/backend/tests
touch D:/PRODUCT/PRODUCT/nankesong/backend/tests/__init__.py
```

- [ ] **Step 2: 写 `backend/app/deps.py`**

```python
from collections.abc import Generator

from sqlalchemy.orm import Session

from app.config import settings
from app.models.base import SessionLocal
from app.services.llm_client import LLMClient, OpenAICompatibleClient


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_llm_client() -> LLMClient:
    return OpenAICompatibleClient(
        api_key=settings.OPENAI_API_KEY,
        model=settings.MODEL_NAME,
        base_url=settings.BASE_URL,
    )


def get_agent():
    # 延迟 import 避免循环依赖（agent 在 Task 7 创建）
    from app.services.agent import FamLinkAgent
    return FamLinkAgent(llm=get_llm_client())
```

- [ ] **Step 3: 写 `backend/tests/fake_llm.py`**

```python
class FakeLLMClient:
    """测试用 LLM 客户端。根据 system prompt 特征词路由到预设响应。"""

    def __init__(self, responses: dict[str, dict]):
        self.responses = responses
        self.calls: list[dict] = []

    def complete_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.7,
    ) -> dict:
        self.calls.append({
            "system": system,
            "user": user,
            "temperature": temperature,
        })

        if "家庭情感翻译官" in system:
            return self.responses["diary"]
        if "陪聊助手" in system:
            if any(kw in user for kw in ["想", "担心", "好久没见", "想念"]):
                return self.responses["chat_notify"]
            return self.responses["chat_reply"]
        if "留言翻译助手" in system:
            return self.responses["transfer"]

        raise ValueError(f"FakeLLMClient: 未匹配 scenario, system={system[:80]}")
```

- [ ] **Step 4: 写 `backend/tests/conftest.py`**

```python
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.deps import get_db, get_agent
from app.main import app
from app.models import Base, Diary, Message, RawData
from app.services.agent import FamLinkAgent  # Task 7 后存在
from tests.fake_llm import FakeLLMClient


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def fake_llm():
    return FakeLLMClient(responses={
        "diary": {
            "title": "今天吃了顿火锅",
            "content": "爸妈，我今天工作挺努力的，晚上和同事吃了顿火锅，你们放心吧，我很好。",
            "suggested_questions": ["和谁一起吃的呀？", "最近降温了穿够没？"],
        },
        "chat_reply": {
            "reply_text": "奶奶您好！照片里小明是和同事一起聚餐呢。",
            "action": "reply",
            "emotion_type": "好奇",
        },
        "chat_notify": {
            "reply_text": "奶奶，小明看到您的留言会很开心的，我会帮您转告。",
            "action": "notify_younger",
            "emotion_type": "想念",
        },
        "transfer": {
            "transfer_content": "奶奶想你了，问你吃饭没",
            "emotion_type": "想念",
            "suggested_reply": "刚吃过啦，周末去看您",
        },
    })


@pytest.fixture
def client(db_session, fake_llm):
    def _get_db_override():
        try:
            yield db_session
        finally:
            pass

    def _get_agent_override():
        return FamLinkAgent(llm=fake_llm)

    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[get_agent] = _get_agent_override
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def seed_raw_data(db_session):
    """塞 3 条 pending raw_data，created_at=今天。"""
    now = datetime.now()
    items = [
        RawData(
            item_id="raw_t01",
            type="image",
            content="https://example.com/1.jpg",
            description="今天吃火锅",
            status="pending",
            created_at=now,
        ),
        RawData(
            item_id="raw_t02",
            type="text",
            content="摔成狗了",
            description=None,
            status="pending",
            created_at=now,
        ),
        RawData(
            item_id="raw_t03",
            type="video",
            content="https://example.com/v.mp4",
            description="骑行绝绝子",
            status="pending",
            created_at=now,
        ),
    ]
    for it in items:
        db_session.add(it)
    db_session.commit()
    return items
```

- [ ] **Step 5: Commit**（agent.py 还不存在，conftest 引用会报 import error；这是预期的，Task 7 完成后会修复）

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "test(backend): add FakeLLMClient and shared fixtures"
```

---

## Task 6: Prompt 模板（diary / chat / transfer）

**Files:**
- Create: `backend/app/prompts/__init__.py`
- Create: `backend/app/prompts/diary.py`
- Create: `backend/app/prompts/chat.py`
- Create: `backend/app/prompts/transfer.py`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p D:/PRODUCT/PRODUCT/nankesong/backend/app/prompts
touch D:/PRODUCT/PRODUCT/nankesong/backend/app/prompts/__init__.py
```

- [ ] **Step 2: 写 `backend/app/prompts/diary.py`**

```python
SYSTEM = """你是 FamLink 的家庭情感翻译官。任务：把年轻人的日常碎片
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
"""

USER_TEMPLATE = """日期: {date}

今日碎片:
{items}

请生成今日家书。"""
```

- [ ] **Step 3: 写 `backend/app/prompts/chat.py`**

```python
SYSTEM = """你是 FamLink 的长辈陪聊助手，帮长辈理解子女近况、回应长辈关心。

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
"""

USER_TEMPLATE = """【今日家书】
标题：{diary_title}
正文：{diary_content}

【长辈的提问】
{elder_query}"""
```

- [ ] **Step 4: 写 `backend/app/prompts/transfer.py`**

```python
SYSTEM = """你是 FamLink 的留言翻译助手。任务：把长辈的关心留言
提炼成简洁通知给小辈。

规则：
- transfer_content：20-30 字，简洁有温度
  * 示例："奶奶想你了，问你吃饭没"
  * 示例："爷爷叮嘱你降温多穿衣"
- emotion_type：从 [关心, 担忧, 欣慰, 想念] 中选一个
- suggested_reply：15-25 字，给小辈一个轻松的回话模板

严格输出 JSON：
{"transfer_content":"...","emotion_type":"...","suggested_reply":"..."}
"""

USER_TEMPLATE = """长辈留言：{elder_query}
Agent 刚才回复长辈：{agent_reply}"""
```

- [ ] **Step 5: 验证 import**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && python -c "from app.prompts import diary, chat, transfer; print(diary.SYSTEM[:20], chat.SYSTEM[:20], transfer.SYSTEM[:20])"
```

期望：三个 SYSTEM 的前 20 字符。

- [ ] **Step 6: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "feat(backend): add diary/chat/transfer prompts"
```

---

## Task 7: FamLinkAgent 实现（TDD）

**Files:**
- Create: `backend/app/services/agent.py`
- Create: `backend/tests/test_agent_service.py`

按 TDD 顺序：先写测试，跑红，再写实现。

### 7.1 先写测试（test_agent_service.py 全量）

- [ ] **Step 1: 写 `backend/tests/test_agent_service.py`**

```python
import pytest

from app.services.agent import (
    AgentOutputError,
    FamLinkAgent,
    SLANG_MAP,
)
from tests.fake_llm import FakeLLMClient


@pytest.fixture
def agent(fake_llm):
    return FamLinkAgent(llm=fake_llm)


def test_preprocess_replaces_slang_in_text_content(agent):
    items = [{"type": "text", "content": "今天emo了想躺平", "description": None}]
    result = agent._preprocess_raw_data(items)
    assert "emo" not in result[0]["processed_text"]
    assert "躺平" not in result[0]["processed_text"]
    assert "心情有点低落" in result[0]["processed_text"]
    assert "休息放松" in result[0]["processed_text"]


def test_preprocess_replaces_slang_in_image_description(agent):
    items = [{
        "type": "image",
        "content": "https://x/a.jpg",
        "description": "周末骑行绝绝子",
    }]
    result = agent._preprocess_raw_data(items)
    assert result[0]["content"] == "https://x/a.jpg"
    assert "绝绝子" not in result[0]["processed_text"]
    assert "很棒" in result[0]["processed_text"]


def test_format_items_prefixes_by_type(agent):
    processed = [
        {"type": "text", "content": "x", "description": None, "processed_text": "摔了"},
        {"type": "image", "content": "u", "description": "d", "processed_text": "火锅"},
        {"type": "video", "content": "v", "description": "d", "processed_text": "骑行"},
    ]
    out = agent._format_items(processed)
    assert "文字动态: 摔了" in out
    assert "图片配文: 火锅" in out
    assert "视频配文: 骑行" in out


def test_generate_diary_cover_from_raw_items_skip_text(agent, fake_llm):
    raw_items = [
        {"type": "text", "content": "摔成狗了", "description": None},
        {"type": "image", "content": "https://x/1.jpg", "description": "火锅"},
        {"type": "video", "content": "https://x/v.mp4", "description": "骑行"},
        {"type": "image", "content": "https://x/2.jpg", "description": "爬山"},
        {"type": "image", "content": "https://x/3.jpg", "description": "晚餐"},
    ]
    result = agent.generate_diary(raw_items, "2026-05-02")
    # 封面只取 image/video，且前 3 个
    assert result["cover_image"] == [
        "https://x/1.jpg",
        "https://x/v.mp4",
        "https://x/2.jpg",
    ]


def test_generate_diary_raises_on_missing_field(fake_llm):
    fake_llm.responses["diary"] = {"title": "x"}  # 缺 content 和 suggested_questions
    agent = FamLinkAgent(llm=fake_llm)
    with pytest.raises(AgentOutputError):
        agent.generate_diary(
            [{"type": "text", "content": "x", "description": None}],
            "2026-05-02",
        )
```

- [ ] **Step 2: 运行测试，期望 ImportError（agent.py 还没写）**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && pytest tests/test_agent_service.py -v
```

期望：collection error — `ModuleNotFoundError: No module named 'app.services.agent'`。

### 7.2 写实现

- [ ] **Step 3: 写 `backend/app/services/agent.py`**

```python
import logging

from app.prompts import chat as chat_prompt
from app.prompts import diary as diary_prompt
from app.prompts import transfer as transfer_prompt
from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)


class AgentOutputError(Exception):
    """Agent LLM 返回 JSON 合法但字段缺失/非法。"""


SLANG_MAP = {
    "emo": "心情有点低落",
    "躺平": "休息放松",
    "PUA": "工作遇到挑战",
    "绝绝子": "很棒",
    "社畜": "工作努力",
    "摸鱼": "休息放松",
    "摔成狗了": "有点小意外",
    "leader": "领导",
}


class FamLinkAgent:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    def generate_diary(self, raw_items: list[dict], date: str) -> dict:
        processed = self._preprocess_raw_data(raw_items)
        items_text = self._format_items(processed)
        user = diary_prompt.USER_TEMPLATE.format(date=date, items=items_text)
        result = self.llm.complete_json(
            diary_prompt.SYSTEM, user, temperature=0.7
        )
        for key in ("title", "content", "suggested_questions"):
            if key not in result:
                raise AgentOutputError(f"diary 输出缺字段: {key}")
        if not isinstance(result["suggested_questions"], list):
            raise AgentOutputError("suggested_questions 非列表")

        covers = [
            it["content"]
            for it in raw_items
            if it["type"] in ("image", "video")
        ][:3]

        return {
            "title": result["title"],
            "content": result["content"],
            "cover_image": covers,
            "suggested_questions": result["suggested_questions"],
        }

    def chat_with_elder(
        self,
        diary_title: str,
        diary_content: str,
        elder_query: str,
    ) -> dict:
        user = chat_prompt.USER_TEMPLATE.format(
            diary_title=diary_title,
            diary_content=diary_content,
            elder_query=elder_query,
        )
        result = self.llm.complete_json(
            chat_prompt.SYSTEM, user, temperature=0.8
        )
        if "reply_text" not in result:
            raise AgentOutputError("chat 输出缺 reply_text")
        action = result.get("action", "reply")
        if action not in ("reply", "notify_younger"):
            logger.warning("chat 返回非法 action=%s, 回退为 reply", action)
            action = "reply"
        return {
            "reply_text": result["reply_text"],
            "action": action,
            "emotion_type": result.get("emotion_type", ""),
        }

    def transfer_message(
        self,
        summary_id: str,
        elder_query: str,
        agent_reply: str,
    ) -> dict:
        user = transfer_prompt.USER_TEMPLATE.format(
            elder_query=elder_query,
            agent_reply=agent_reply,
        )
        result = self.llm.complete_json(
            transfer_prompt.SYSTEM, user, temperature=0.7
        )
        if "transfer_content" not in result:
            raise AgentOutputError("transfer 输出缺 transfer_content")
        transfer_content = result["transfer_content"]
        if len(transfer_content) > 40:
            transfer_content = transfer_content[:40]
        return {
            "transfer_content": transfer_content,
            "emotion_type": result.get("emotion_type", ""),
            "suggested_reply": result.get("suggested_reply", ""),
        }

    def _preprocess_raw_data(self, items: list[dict]) -> list[dict]:
        result = []
        for it in items:
            if it["type"] == "text":
                text = it["content"]
            else:
                text = it.get("description") or ""
            for slang, replacement in SLANG_MAP.items():
                text = text.replace(slang, replacement)
            result.append({
                "type": it["type"],
                "content": it["content"],
                "description": it.get("description"),
                "processed_text": text,
            })
        return result

    def _format_items(self, processed: list[dict]) -> str:
        lines = []
        for it in processed:
            text = it["processed_text"] or "（无配文）"
            if it["type"] == "text":
                lines.append(f"文字动态: {text}")
            elif it["type"] == "image":
                lines.append(f"图片配文: {text}")
            elif it["type"] == "video":
                lines.append(f"视频配文: {text}")
        return "\n".join(lines)
```

- [ ] **Step 4: 运行测试，期望全部通过**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && pytest tests/test_agent_service.py -v
```

期望：5 passed。

- [ ] **Step 5: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "feat(backend): implement FamLinkAgent with three scenarios"
```

---

## Task 8: Data API（GET /data/raw + POST /data/raw/delete）

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/data.py`
- Create: `backend/tests/test_data_api.py`
- Modify: `backend/app/main.py`（挂载 router）

### 8.1 先写测试

- [ ] **Step 1: 写 `backend/tests/test_data_api.py`**

```python
from datetime import datetime, timedelta

from app.models import RawData


def test_get_raw_returns_pending_only_for_date(client, db_session):
    today = datetime.now()
    yesterday = today - timedelta(days=1)
    db_session.add_all([
        RawData(item_id="p1", type="text", content="今天", status="pending", created_at=today),
        RawData(item_id="p2", type="text", content="昨天", status="pending", created_at=yesterday),
        RawData(item_id="p3", type="text", content="已删", status="deleted", created_at=today),
    ])
    db_session.commit()

    resp = client.get(f"/api/v1/data/raw?date={today.strftime('%Y-%m-%d')}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    item_ids = [it["item_id"] for it in body["data"]["items"]]
    assert "p1" in item_ids
    assert "p2" not in item_ids
    assert "p3" not in item_ids


def test_get_raw_invalid_date_returns_400(client):
    resp = client.get("/api/v1/data/raw?date=not-a-date")
    assert resp.status_code == 400
    assert resp.json()["code"] == 400


def test_get_raw_empty_returns_empty_items(client):
    resp = client.get("/api/v1/data/raw?date=2020-01-01")
    assert resp.status_code == 200
    assert resp.json()["data"]["items"] == []


def test_delete_soft_deletes_items(client, db_session):
    now = datetime.now()
    db_session.add_all([
        RawData(item_id="d1", type="text", content="a", status="pending", created_at=now),
        RawData(item_id="d2", type="text", content="b", status="pending", created_at=now),
    ])
    db_session.commit()

    resp = client.post(
        "/api/v1/data/raw/delete",
        json={"item_ids": ["d1", "d2"], "user_id": "u1"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["deleted_count"] == 2

    d1 = db_session.query(RawData).filter_by(item_id="d1").first()
    assert d1.status == "deleted"


def test_delete_idempotent_second_call_counts_zero(client, db_session):
    now = datetime.now()
    db_session.add(RawData(item_id="x1", type="text", content="a", status="pending", created_at=now))
    db_session.commit()

    r1 = client.post("/api/v1/data/raw/delete", json={"item_ids": ["x1"], "user_id": "u"})
    assert r1.json()["data"]["deleted_count"] == 1

    r2 = client.post("/api/v1/data/raw/delete", json={"item_ids": ["x1"], "user_id": "u"})
    assert r2.json()["data"]["deleted_count"] == 0


def test_delete_empty_list_returns_zero(client):
    resp = client.post(
        "/api/v1/data/raw/delete",
        json={"item_ids": [], "user_id": "u"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["deleted_count"] == 0
```

- [ ] **Step 2: 运行测试，期望失败**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && pytest tests/test_data_api.py -v
```

期望：404（路由没挂）或 ModuleNotFoundError（data.py 不存在）。

### 8.2 写实现

- [ ] **Step 3: 创建目录**

```bash
mkdir -p D:/PRODUCT/PRODUCT/nankesong/backend/app/api
touch D:/PRODUCT/PRODUCT/nankesong/backend/app/api/__init__.py
```

- [ ] **Step 4: 写 `backend/app/api/data.py`**

```python
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import RawData
from app.schemas.requests import DeleteRequest
from app.schemas.responses import (
    ApiResponse,
    DeleteResultData,
    RawItem,
    RawListData,
)

router = APIRouter()


@router.get("/raw", response_model=ApiResponse[RawListData])
def get_raw(
    date: str = Query(..., description="YYYY-MM-DD"),
    user_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    try:
        start = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={
                "code": 400,
                "message": "日期格式错误，应为 YYYY-MM-DD",
                "data": None,
            },
        )
    end = start + timedelta(days=1)

    rows = (
        db.query(RawData)
        .filter(
            RawData.status == "pending",
            RawData.created_at >= start,
            RawData.created_at < end,
        )
        .order_by(RawData.created_at)
        .all()
    )

    items = [
        RawItem(
            item_id=r.item_id,
            type=r.type,
            content=r.content,
            description=r.description,
            timestamp=str(int(r.created_at.timestamp())),
        )
        for r in rows
    ]
    return ApiResponse[RawListData](
        code=200,
        message="success",
        data=RawListData(date=date, items=items),
    )


@router.post("/raw/delete", response_model=ApiResponse[DeleteResultData])
def delete_raw(req: DeleteRequest, db: Session = Depends(get_db)):
    if not req.item_ids:
        return ApiResponse[DeleteResultData](
            code=200,
            message="成功删除 0 条数据",
            data=DeleteResultData(deleted_count=0),
        )

    hits = (
        db.query(RawData)
        .filter(RawData.item_id.in_(req.item_ids), RawData.status == "pending")
        .all()
    )
    for h in hits:
        h.status = "deleted"
    db.commit()
    count = len(hits)
    return ApiResponse[DeleteResultData](
        code=200,
        message=f"成功删除 {count} 条数据",
        data=DeleteResultData(deleted_count=count),
    )
```

- [ ] **Step 5: 修改 `backend/app/main.py` 挂载 router**

在 `from app.models import Base, engine` 后加 `from app.api import data`，在 `@app.get("/health")` 前加：

```python
app.include_router(data.router, prefix="/api/v1/data", tags=["data"])
```

最终 `main.py` 完整版：

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import data
from app.models import Base, engine

app = FastAPI(
    title="FamLink API",
    description="代际沟通 AI 助手 - 黑客松版",
    version="1.0.0",
)

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router, prefix="/api/v1/data", tags=["data"])


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: 运行测试**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && pytest tests/test_data_api.py -v
```

期望：6 passed。

- [ ] **Step 7: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "feat(backend): implement data APIs (GET /raw, POST /raw/delete)"
```

---

## Task 9: Agent API（generate-summary + chat）

**Files:**
- Create: `backend/app/api/agent.py`
- Create: `backend/tests/test_agent_api.py`
- Modify: `backend/app/main.py`（挂 router）

### 9.1 先写测试

- [ ] **Step 1: 写 `backend/tests/test_agent_api.py`**

```python
import json
from datetime import datetime

from app.models import Diary, Message, RawData


def test_generate_summary_happy_path(client, db_session):
    now = datetime.now()
    db_session.add_all([
        RawData(item_id="r1", type="image", content="https://x/1.jpg", description="火锅", status="pending", created_at=now),
        RawData(item_id="r2", type="text", content="摔成狗了", description=None, status="pending", created_at=now),
        RawData(item_id="r3", type="video", content="https://x/v.mp4", description="骑行", status="pending", created_at=now),
    ])
    db_session.commit()

    resp = client.post(
        "/api/v1/agent/generate-summary",
        json={"date": now.strftime("%Y-%m-%d"), "user_id": "u1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 200
    data = body["data"]
    assert data["summary_id"].startswith("sum_")
    assert isinstance(data["cover_image"], list)
    assert data["cover_image"] == ["https://x/1.jpg", "https://x/v.mp4"]
    assert len(data["suggested_questions"]) >= 1

    for item_id in ("r1", "r2", "r3"):
        row = db_session.query(RawData).filter_by(item_id=item_id).first()
        assert row.status == "processed"

    diary = db_session.query(Diary).filter_by(summary_id=data["summary_id"]).first()
    assert diary is not None
    assert json.loads(diary.cover_image) == data["cover_image"]


def test_generate_summary_no_pending_returns_400(client):
    resp = client.post(
        "/api/v1/agent/generate-summary",
        json={"date": "2020-01-01", "user_id": "u1"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == 400


def test_generate_summary_cover_skips_text_and_caps_at_three(client, db_session):
    now = datetime.now()
    db_session.add_all([
        RawData(item_id="t1", type="text", content="x", status="pending", created_at=now),
        RawData(item_id="t2", type="image", content="u1", description="d", status="pending", created_at=now),
        RawData(item_id="t3", type="image", content="u2", description="d", status="pending", created_at=now),
        RawData(item_id="t4", type="image", content="u3", description="d", status="pending", created_at=now),
        RawData(item_id="t5", type="image", content="u4", description="d", status="pending", created_at=now),
    ])
    db_session.commit()

    resp = client.post(
        "/api/v1/agent/generate-summary",
        json={"date": now.strftime("%Y-%m-%d"), "user_id": "u"},
    )
    assert resp.status_code == 200
    cover = resp.json()["data"]["cover_image"]
    assert cover == ["u1", "u2", "u3"]


def test_chat_reply_action_no_message_written(client, db_session):
    db_session.add(Diary(
        summary_id="sum_abc",
        date="2026-05-02",
        title="今天的家书",
        content="爸妈，今天...",
        cover_image="[]",
        suggested_questions="[]",
        raw_data_ids="[]",
    ))
    db_session.commit()

    resp = client.post(
        "/api/v1/agent/chat",
        json={"query": "这是和谁一起吃的呀？", "summary_id": "sum_abc"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["action"] == "reply"
    assert data.get("transfer_content") is None
    assert db_session.query(Message).count() == 0


def test_chat_notify_younger_writes_message_and_returns_transfer(client, db_session):
    db_session.add(Diary(
        summary_id="sum_xyz",
        date="2026-05-02",
        title="今天的家书",
        content="爸妈，今天...",
        cover_image="[]",
        suggested_questions="[]",
        raw_data_ids="[]",
    ))
    db_session.commit()

    resp = client.post(
        "/api/v1/agent/chat",
        json={"query": "好久没见他了，想他了", "summary_id": "sum_xyz"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["action"] == "notify_younger"
    assert data["transfer_content"]

    msgs = db_session.query(Message).filter_by(summary_id="sum_xyz").all()
    assert len(msgs) == 1
    assert msgs[0].transfer_content == data["transfer_content"]
    assert msgs[0].is_transferred is False


def test_chat_missing_diary_returns_404(client):
    resp = client.post(
        "/api/v1/agent/chat",
        json={"query": "问问", "summary_id": "sum_not_exist"},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == 404
```

- [ ] **Step 2: 运行测试，期望失败**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && pytest tests/test_agent_api.py -v
```

期望：失败（404 或 import 错误）。

### 9.2 写实现

- [ ] **Step 3: 写 `backend/app/api/agent.py`**

```python
import json
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.deps import get_agent, get_db
from app.models import Diary, Message, RawData
from app.schemas.requests import ChatRequest, GenerateSummaryRequest
from app.schemas.responses import ApiResponse, ChatReplyData, DiaryData
from app.services.agent import FamLinkAgent

router = APIRouter()


@router.post("/generate-summary", response_model=ApiResponse[DiaryData])
def generate_summary(
    req: GenerateSummaryRequest,
    db: Session = Depends(get_db),
    agent: FamLinkAgent = Depends(get_agent),
):
    try:
        start = datetime.strptime(req.date, "%Y-%m-%d")
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={"code": 400, "message": "日期格式错误", "data": None},
        )
    end = start + timedelta(days=1)

    rows = (
        db.query(RawData)
        .filter(
            RawData.status == "pending",
            RawData.created_at >= start,
            RawData.created_at < end,
        )
        .order_by(RawData.created_at)
        .all()
    )
    if not rows:
        return JSONResponse(
            status_code=400,
            content={
                "code": 400,
                "message": "当日没有可处理的数据",
                "data": None,
            },
        )

    raw_items = [
        {"type": r.type, "content": r.content, "description": r.description}
        for r in rows
    ]
    result = agent.generate_diary(raw_items, req.date)
    summary_id = f"sum_{uuid4().hex[:8]}"

    diary = Diary(
        summary_id=summary_id,
        date=req.date,
        title=result["title"],
        content=result["content"],
        cover_image=json.dumps(result["cover_image"], ensure_ascii=False),
        suggested_questions=json.dumps(result["suggested_questions"], ensure_ascii=False),
        raw_data_ids=json.dumps([r.item_id for r in rows], ensure_ascii=False),
    )
    db.add(diary)
    for r in rows:
        r.status = "processed"
    db.commit()

    return ApiResponse[DiaryData](
        code=200,
        message="Agent 处理完成",
        data=DiaryData(
            summary_id=summary_id,
            title=result["title"],
            content=result["content"],
            cover_image=result["cover_image"],
            suggested_questions=result["suggested_questions"],
        ),
    )


@router.post("/chat", response_model=ApiResponse[ChatReplyData])
def chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    agent: FamLinkAgent = Depends(get_agent),
):
    diary = db.query(Diary).filter_by(summary_id=req.summary_id).first()
    if diary is None:
        return JSONResponse(
            status_code=404,
            content={"code": 404, "message": "日记不存在", "data": None},
        )

    chat_result = agent.chat_with_elder(
        diary_title=diary.title,
        diary_content=diary.content,
        elder_query=req.query,
    )

    if chat_result["action"] == "reply":
        return ApiResponse[ChatReplyData](
            code=200,
            message="success",
            data=ChatReplyData(
                reply_text=chat_result["reply_text"],
                action="reply",
            ),
        )

    transfer_result = agent.transfer_message(
        summary_id=req.summary_id,
        elder_query=req.query,
        agent_reply=chat_result["reply_text"],
    )
    msg = Message(
        summary_id=req.summary_id,
        elder_query=req.query,
        agent_reply=chat_result["reply_text"],
        transfer_content=transfer_result["transfer_content"],
        is_transferred=False,
    )
    db.add(msg)
    db.commit()

    return ApiResponse[ChatReplyData](
        code=200,
        message="success",
        data=ChatReplyData(
            reply_text=chat_result["reply_text"],
            action="notify_younger",
            transfer_content=transfer_result["transfer_content"],
        ),
    )
```

- [ ] **Step 4: 修改 `backend/app/main.py` 挂 agent router**

在 `from app.api import data` 改为 `from app.api import agent, data`，在 `include_router(data.router, ...)` 下加：

```python
app.include_router(agent.router, prefix="/api/v1/agent", tags=["agent"])
```

- [ ] **Step 5: 运行测试**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && pytest tests/test_agent_api.py -v
```

期望：6 passed。

- [ ] **Step 6: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "feat(backend): implement agent APIs (generate-summary, chat)"
```

---

## Task 10: Messages API（GET /messages）

**Files:**
- Create: `backend/app/api/messages.py`
- Create: `backend/tests/test_messages_api.py`
- Modify: `backend/app/main.py`

### 10.1 先写测试

- [ ] **Step 1: 写 `backend/tests/test_messages_api.py`**

```python
from datetime import datetime, timedelta

from app.models import Message


def test_get_messages_returns_desc_by_created_at(client, db_session):
    now = datetime.now()
    db_session.add_all([
        Message(
            summary_id="s1",
            elder_query="q1",
            transfer_content="老的",
            is_transferred=False,
            created_at=now - timedelta(hours=2),
        ),
        Message(
            summary_id="s2",
            elder_query="q2",
            transfer_content="新的",
            is_transferred=False,
            created_at=now,
        ),
    ])
    db_session.commit()

    resp = client.get("/api/v1/messages")
    assert resp.status_code == 200
    msgs = resp.json()["data"]["messages"]
    assert [m["transfer_content"] for m in msgs] == ["新的", "老的"]


def test_get_messages_empty_returns_empty_list(client):
    resp = client.get("/api/v1/messages")
    assert resp.status_code == 200
    assert resp.json()["data"]["messages"] == []
```

- [ ] **Step 2: 运行测试，期望 404**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && pytest tests/test_messages_api.py -v
```

### 10.2 写实现

- [ ] **Step 3: 写 `backend/app/api/messages.py`**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Message
from app.schemas.responses import ApiResponse, MessageItem, MessageListData

router = APIRouter()


@router.get("/messages", response_model=ApiResponse[MessageListData])
def get_messages(
    user_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    rows = db.query(Message).order_by(Message.created_at.desc()).all()
    items = [
        MessageItem(
            summary_id=r.summary_id,
            transfer_content=r.transfer_content or "",
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]
    return ApiResponse[MessageListData](
        code=200,
        message="success",
        data=MessageListData(messages=items),
    )
```

- [ ] **Step 4: 修改 `backend/app/main.py` 挂 messages router**

`from app.api import agent, data` 改为 `from app.api import agent, data, messages`，追加：

```python
app.include_router(messages.router, prefix="/api/v1", tags=["messages"])
```

- [ ] **Step 5: 运行测试**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && pytest tests/test_messages_api.py -v
```

期望：2 passed。

- [ ] **Step 6: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "feat(backend): implement GET /messages"
```

---

## Task 11: Mock 数据生成脚本

**Files:**
- Create: `backend/scripts/__init__.py`
- Create: `backend/scripts/mock_data.py`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p D:/PRODUCT/PRODUCT/nankesong/backend/scripts
touch D:/PRODUCT/PRODUCT/nankesong/backend/scripts/__init__.py
```

- [ ] **Step 2: 写 `backend/scripts/mock_data.py`**

```python
"""Mock 数据生成脚本。

运行：cd backend && python -m scripts.mock_data
"""
from datetime import datetime

from app.models import Base, RawData
from app.models.base import SessionLocal, engine

MOCK_ITEMS = [
    {
        "item_id": "raw_001",
        "type": "image",
        "content": "https://picsum.photos/seed/hotpot/800/600",
        "description": "今天被 leader 骂了，怒吃一顿火锅",
    },
    {
        "item_id": "raw_002",
        "type": "text",
        "content": "摔成狗了",
        "description": None,
    },
    {
        "item_id": "raw_003",
        "type": "video",
        "content": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
        "description": "周末骑行30公里，绝绝子",
    },
    {
        "item_id": "raw_004",
        "type": "image",
        "content": "https://picsum.photos/seed/coffee/800/600",
        "description": "下午摸鱼喝了杯拿铁",
    },
    {
        "item_id": "raw_005",
        "type": "text",
        "content": "今天emo了，想躺平",
        "description": None,
    },
    {
        "item_id": "raw_006",
        "type": "image",
        "content": "https://picsum.photos/seed/mountain/800/600",
        "description": "周末爬山，风景太美了",
    },
    {
        "item_id": "raw_007",
        "type": "image",
        "content": "https://picsum.photos/seed/dinner/800/600",
        "description": "今天自己做了一顿晚餐",
    },
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        deleted = db.query(RawData).delete()
        now = datetime.now()
        for item in MOCK_ITEMS:
            db.add(RawData(
                item_id=item["item_id"],
                type=item["type"],
                content=item["content"],
                description=item["description"],
                status="pending",
                created_at=now,
            ))
        db.commit()
        print(f"数据库表创建成功")
        print(f"清理旧数据 {deleted} 条")
        print(f"已生成 {len(MOCK_ITEMS)} 条 Mock 数据")
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: 执行脚本验证**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && python -m scripts.mock_data
```

期望输出包含 `已生成 7 条 Mock 数据`。

- [ ] **Step 4: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "feat(backend): mock data generator script"
```

---

## Task 12: 全量回归测试 + 手动 curl 冒烟

**Files:** 无新增

- [ ] **Step 1: 全量 pytest**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && pytest -v
```

期望：全绿（19 左右 passed）。

- [ ] **Step 2: 启动 uvicorn**

```bash
cd D:/PRODUCT/PRODUCT/nankesong/backend && uvicorn app.main:app --port 8000
```

（在单独终端运行；后续步骤在另一个终端。）

- [ ] **Step 3: 冒烟 `/health`**

```bash
curl -s http://localhost:8000/health
```

期望：`{"status":"ok"}`。

- [ ] **Step 4: 冒烟 `/api/v1/data/raw`**

```bash
TODAY=$(date +%Y-%m-%d)
curl -s "http://localhost:8000/api/v1/data/raw?date=$TODAY"
```

期望：`code=200`，items 里有 7 条（mock 数据跑过后）。

- [ ] **Step 5: 冒烟 `/api/v1/data/raw/delete`**

```bash
curl -s -X POST "http://localhost:8000/api/v1/data/raw/delete" \
  -H "Content-Type: application/json" \
  -d '{"item_ids":["raw_005"],"user_id":"u"}'
```

期望：`deleted_count=1`。

- [ ] **Step 6: 停止 uvicorn**（Ctrl+C）

- [ ] **Step 7: 如果任何冒烟失败，修复并重跑 pytest**

不失败就跳到下一步。

- [ ] **Step 8: 无新代码改动时不 commit，直接进入 Task 13**

---

## Task 13: README 使用说明

**Files:**
- Create: `backend/README.md`

- [ ] **Step 1: 写 `backend/README.md`**

```markdown
# FamLink Backend

代际沟通 AI 助手后端。5 个接口、3 张表、Agent 三场景。

## 环境准备

Python 3.11+。

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入 OPENAI_API_KEY
```

## 初始化 Mock 数据

```bash
python -m scripts.mock_data
```

会在 `data/famlink.db` 建表并插入 7 条 Mock 数据。

## 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

访问 <http://localhost:8000/docs> 查看 Swagger UI。

## 接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/v1/data/raw?date=YYYY-MM-DD` | 获取当日待审原始数据 |
| POST | `/api/v1/data/raw/delete` | 批量软删除原始数据 |
| POST | `/api/v1/agent/generate-summary` | 生成长辈友好型日记 |
| POST | `/api/v1/agent/chat` | 长辈对话（可能触发留言传达） |
| GET  | `/api/v1/messages` | 获取留言列表 |
| GET  | `/health` | 健康检查 |

详细请求/响应结构见 `docs/接口文档.md` 或 `/docs` Swagger UI。

## 配置项（.env）

| 变量 | 默认 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | (必填) | OpenAI 或兼容网关的 API Key |
| `BASE_URL` | (空) | OpenAI 兼容网关地址，空则走官方 |
| `MODEL_NAME` | `gpt-4o` | 模型名 |
| `DATABASE_URL` | `sqlite:///./data/famlink.db` | SQLite 路径 |

## 测试

```bash
pytest -v
```

LLM 调用在测试中被 `FakeLLMClient` 替换，不消耗真实 token。
```

- [ ] **Step 2: Commit**

```bash
cd D:/PRODUCT/PRODUCT/nankesong && git add backend/ && git commit -m "docs(backend): add README with run instructions"
```

---

## 验收清单

全部提交完成后，逐项勾选：

- [ ] `git log --oneline` 从 Task 0 到 Task 13 共 14 次提交
- [ ] `cd backend && uvicorn app.main:app --port 8000` 能起
- [ ] `python -m scripts.mock_data` 产出 7 条 raw_data
- [ ] `pytest -v` 全绿
- [ ] `curl http://localhost:8000/health` 返回 `{"status":"ok"}`
- [ ] `curl "http://localhost:8000/api/v1/data/raw?date=$(date +%Y-%m-%d)"` 返回 7 条 items
- [ ] <http://localhost:8000/docs> Swagger UI 能访问，5 个业务接口 schema 完整
- [ ] 响应格式严格匹配 `docs/接口文档.md`（`summary_id`、`cover_image` 单数字段名）
- [ ] 前端 `feature/frontend` 分支无需改动即可联调

