# AI 家庭日记 · 后端实施计划（TDD 详尽版）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 FastAPI + SQLAlchemy + SQLite 构建 AI 家庭日记的后端 API，覆盖素材采集、Agent 日记生成、编辑/发布、评论、长辈语音问答的完整链路。

**Architecture:** 单进程同步 FastAPI 服务。外部大模型调用（视觉描述、日记生成、意图判定、问答）通过依赖注入传入 client，测试里注入 Fake 避免真调 API。数据落本地 SQLite，视频帧落本地目录。前端、Insta360 采集器、TTS/ASR 均在本计划之外（前端独立项目；相机由硬件队员直接打 `POST /ingest/clip`；TTS/ASR 由前端直接调浏览器 API 或云 API）。

**Tech Stack:** Python 3.11+ · FastAPI · SQLAlchemy 2.x (sync) · Pydantic v2 · pytest · anthropic SDK · FFmpeg (subprocess)

**Spec 依据：** `docs/superpowers/specs/2026-05-02-ai-family-diary-design.md`

---

## 文件结构

```
backend/
├── pyproject.toml
├── .env.example
├── app/
│   ├── __init__.py
│   ├── main.py                         # FastAPI app 入口，CORS + 路由挂载
│   ├── config.py                       # Settings（API keys、数据目录）
│   ├── db.py                           # Engine + Session + get_db 依赖
│   ├── models.py                       # 6 张 SQLAlchemy 表
│   ├── schemas.py                      # Pydantic 请求/响应模型
│   ├── seed.py                         # 初始化一对 demo 家庭
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── ingest.py                   # POST /ingest/clip、/ingest/social
│   │   ├── clips.py                    # GET /clips
│   │   ├── diary.py                    # /diary/* 全部端点
│   │   └── interactions.py             # /diary/:id/comment、/diary/:id/ask
│   └── services/
│       ├── __init__.py
│       ├── frame_extractor.py          # FFmpeg 抽帧
│       ├── vision.py                   # 帧图 → 描述文本
│       ├── diary_generator.py          # 素材 → 日记 + 选图
│       ├── intent_classifier.py        # 文本 → question / comment
│       └── qa.py                       # 问题 + 日记 → 答案
└── tests/
    ├── __init__.py
    ├── conftest.py                     # 公共 fixture
    ├── fixtures/
    │   └── sample.mp4                  # 3 秒测试视频
    ├── test_health.py
    ├── test_frame_extractor.py
    ├── test_vision.py
    ├── test_diary_generator.py
    ├── test_intent_classifier.py
    ├── test_qa.py
    ├── test_ingest.py
    ├── test_clips.py
    ├── test_diary_generate.py
    ├── test_diary_today.py
    ├── test_diary_edit.py
    ├── test_diary_publish.py
    ├── test_diary_history.py
    ├── test_interactions_comment.py
    ├── test_interactions_ask.py
    └── test_integration.py
```

**设计原则：**
- 每个文件只一个清晰职责（路由文件只写路由；业务逻辑在 services）
- Service 函数接收 client 参数做依赖注入（测试时替换成 Fake）
- 测试用 `:memory:` SQLite + FastAPI TestClient，无需真 LLM 调用
- 频繁 commit（每个 Task 末尾一个 commit）

---

## Task 索引

1. Task 1 · 项目脚手架 + health 接口
2. Task 2 · 配置模块
3. Task 3 · 数据库引擎 + 会话
4. Task 4 · SQLAlchemy 6 张表
5. Task 5 · Pydantic schemas（含 DiaryOut.comments 字段）
6. Task 6 · pytest 公共 fixture
7. Task 7 · FFmpeg 抽帧 service
8. Task 8 · 视觉描述 service
9. Task 9 · `POST /ingest/clip`（最小版）
9b. Task 9b · 接通 `/ingest/clip` 的"无 caption 自动跑视觉"分支
10. Task 10 · `POST /ingest/social`
11. Task 11 · `GET /clips`
12. Task 12 · 日记生成 service
13. Task 13 · `POST /diary/generate`
14. Task 14 · `GET /diary/today`（含 junior 拉评论）
15. Task 15 · `PATCH /diary/:id`（段落可见性）
16. Task 16 · `POST /diary/:id/publish`
17. Task 17 · `GET /diary/history`
18. Task 18 · `POST /diary/:id/comment`
19. Task 19 · 意图判定 service
20. Task 20 · Q&A service
21. Task 21 · `POST /diary/:id/ask`
22. Task 22 · CORS + 最终 wire-up
23. Task 23 · seed 脚本 + 端到端集成测试 + run book

---

## Task 1: 项目脚手架 + health 接口

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_health.py`
- Create: `backend/.gitignore`

- [ ] **Step 1: 写失败的 health 测试**

Create `backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient
from app.main import app


def test_health_returns_ok():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: 写 pyproject.toml**

Create `backend/pyproject.toml`:

```toml
[project]
name = "nankesong-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "sqlalchemy>=2.0",
    "pydantic>=2.9",
    "pydantic-settings>=2.6",
    "python-multipart>=0.0.12",
    "anthropic>=0.40",
    "httpx>=0.27",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 3: 写 .env.example 和 .gitignore**

Create `backend/.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-...
DATA_DIR=./data
FFMPEG_BIN=ffmpeg
```

Create `backend/.gitignore`:

```
__pycache__/
*.pyc
.pytest_cache/
.venv/
venv/
.env
data/
*.db
```

- [ ] **Step 4: 写最小 FastAPI app**

Create `backend/app/__init__.py`: (empty)

Create `backend/tests/__init__.py`: (empty)

Create `backend/app/main.py`:

```python
from fastapi import FastAPI

app = FastAPI(title="AI 家庭日记 API")


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: 运行测试验证通过**

Run (from `backend/` directory):

```bash
python -m venv .venv
.venv/Scripts/activate   # Windows bash
pip install -e ".[dev]"
pytest tests/test_health.py -v
```

Expected: `test_health_returns_ok PASSED`

- [ ] **Step 6: Commit**

```bash
cd backend && git add .
git commit -m "feat(backend): scaffold FastAPI app with health endpoint"
```

---

## Task 2: 配置模块

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/tests/test_config.py`

- [ ] **Step 1: 写失败的 config 测试**

Create `backend/tests/test_config.py`:

```python
import os
from app.config import Settings


def test_settings_reads_env_vars(monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("FFMPEG_BIN", "/usr/bin/ffmpeg")

    settings = Settings()

    assert settings.anthropic_api_key == "sk-test-key"
    assert settings.data_dir == str(tmp_path)
    assert settings.ffmpeg_bin == "/usr/bin/ffmpeg"


def test_settings_has_defaults(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.delenv("DATA_DIR", raising=False)
    monkeypatch.delenv("FFMPEG_BIN", raising=False)

    settings = Settings()

    assert settings.data_dir == "./data"
    assert settings.ffmpeg_bin == "ffmpeg"
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pytest tests/test_config.py -v`
Expected: `ModuleNotFoundError: No module named 'app.config'`

- [ ] **Step 3: 写 Settings**

Create `backend/app/config.py`:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    anthropic_api_key: str
    data_dir: str = "./data"
    ffmpeg_bin: str = "ffmpeg"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pytest tests/test_config.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add app/config.py tests/test_config.py
git commit -m "feat(backend): add Settings with env var support"
```

---

## Task 3: 数据库引擎 + 会话

**Files:**
- Create: `backend/app/db.py`
- Create: `backend/tests/test_db.py`

- [ ] **Step 1: 写失败的 db 测试**

Create `backend/tests/test_db.py`:

```python
from sqlalchemy import text
from app.db import engine_for_url, session_scope


def test_engine_for_url_creates_sqlite_engine():
    engine = engine_for_url("sqlite:///:memory:")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1")).scalar()
        assert result == 1


def test_session_scope_commits_on_success():
    engine = engine_for_url("sqlite:///:memory:")

    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)"))
        conn.commit()

    with session_scope(engine) as session:
        session.execute(text("INSERT INTO t (v) VALUES ('x')"))

    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM t")).scalar()
        assert count == 1


def test_session_scope_rolls_back_on_exception():
    engine = engine_for_url("sqlite:///:memory:")

    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)"))
        conn.commit()

    try:
        with session_scope(engine) as session:
            session.execute(text("INSERT INTO t (v) VALUES ('y')"))
            raise RuntimeError("boom")
    except RuntimeError:
        pass

    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM t")).scalar()
        assert count == 0
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pytest tests/test_db.py -v`
Expected: `ImportError: cannot import name 'engine_for_url'`

- [ ] **Step 3: 写 db.py**

Create `backend/app/db.py`:

```python
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


def engine_for_url(url: str) -> Engine:
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, future=True)


@contextmanager
def session_scope(engine: Engine) -> Iterator[Session]:
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db_dependency(engine: Engine):
    """FastAPI dependency factory; use in routers via Depends."""
    def _dep() -> Iterator[Session]:
        with session_scope(engine) as session:
            yield session
    return _dep
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pytest tests/test_db.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add app/db.py tests/test_db.py
git commit -m "feat(backend): add SQLAlchemy engine and session_scope"
```

---

## Task 4: SQLAlchemy 6 张表

**Files:**
- Create: `backend/app/models.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: 写失败的 models 测试**

Create `backend/tests/test_models.py`:

```python
from datetime import datetime, date

from app.db import engine_for_url, session_scope
from app.models import Base, User, Family, RawClip, Diary, Comment, QaLog


def _fresh_engine():
    engine = engine_for_url("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


def test_create_family_and_users():
    engine = _fresh_engine()
    with session_scope(engine) as s:
        junior = User(role="junior", name="小明")
        senior = User(role="senior", name="妈妈")
        s.add_all([junior, senior])
        s.flush()
        fam = Family(junior_user_id=junior.id, senior_user_id=senior.id)
        s.add(fam)
        s.flush()
        junior.family_id = fam.id
        senior.family_id = fam.id

    with session_scope(engine) as s:
        users = s.query(User).all()
        assert len(users) == 2
        assert {u.role for u in users} == {"junior", "senior"}


def test_raw_clip_defaults_to_visible():
    engine = _fresh_engine()
    with session_scope(engine) as s:
        clip = RawClip(
            source="camera",
            file_path="/tmp/x.mp4",
            captured_at=datetime(2026, 5, 2, 12, 0, 0),
            auto_caption="小明在吃火锅",
        )
        s.add(clip)

    with session_scope(engine) as s:
        c = s.query(RawClip).first()
        assert c.visibility == "visible"


def test_diary_body_json_roundtrip():
    engine = _fresh_engine()
    with session_scope(engine) as s:
        junior = User(role="junior", name="小明")
        senior = User(role="senior", name="妈妈")
        s.add_all([junior, senior]); s.flush()
        fam = Family(junior_user_id=junior.id, senior_user_id=senior.id)
        s.add(fam); s.flush()

        d = Diary(
            family_id=fam.id,
            date=date(2026, 5, 2),
            status="draft",
            title="小明的一天",
            body_json=[{"id": "p1", "text": "今天...", "source_clip_ids": [1], "hidden": False}],
            cover_images_json=["/img/1.jpg"],
        )
        s.add(d)

    with session_scope(engine) as s:
        d = s.query(Diary).first()
        assert d.body_json[0]["text"] == "今天..."
        assert d.cover_images_json == ["/img/1.jpg"]


def test_comment_and_qa_log():
    engine = _fresh_engine()
    with session_scope(engine) as s:
        u = User(role="senior", name="妈妈")
        s.add(u); s.flush()
        fam = Family(junior_user_id=u.id, senior_user_id=u.id)
        s.add(fam); s.flush()
        d = Diary(family_id=fam.id, date=date(2026, 5, 2), status="published",
                  title="t", body_json=[], cover_images_json=[])
        s.add(d); s.flush()
        s.add(Comment(diary_id=d.id, author_id=u.id, content="想你了"))
        s.add(QaLog(diary_id=d.id, question="吃什么？", answer="火锅"))

    with session_scope(engine) as s:
        assert s.query(Comment).count() == 1
        assert s.query(QaLog).count() == 1
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pytest tests/test_models.py -v`
Expected: `ImportError: cannot import name 'Base'`

- [ ] **Step 3: 写 models.py**

Create `backend/app/models.py`:

```python
from datetime import datetime, date
from typing import Optional

from sqlalchemy import String, Integer, ForeignKey, DateTime, Date, JSON, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(16))  # 'junior' | 'senior'
    name: Mapped[str] = mapped_column(String(64))
    family_id: Mapped[Optional[int]] = mapped_column(ForeignKey("family.id"), nullable=True)


class Family(Base):
    __tablename__ = "family"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    junior_user_id: Mapped[int] = mapped_column(Integer)
    senior_user_id: Mapped[int] = mapped_column(Integer)


class RawClip(Base):
    __tablename__ = "raw_clips"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(16))  # 'camera' | 'social'
    file_path: Mapped[str] = mapped_column(String(512))
    captured_at: Mapped[datetime] = mapped_column(DateTime)
    auto_caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    visibility: Mapped[str] = mapped_column(String(16), default="visible")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Diary(Base):
    __tablename__ = "diaries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("family.id"))
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # 'draft' | 'published'
    title: Mapped[str] = mapped_column(String(128))
    body_json: Mapped[list] = mapped_column(JSON, default=list)
    cover_images_json: Mapped[list] = mapped_column(JSON, default=list)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    diary_id: Mapped[int] = mapped_column(ForeignKey("diaries.id"))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text)
    audio_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class QaLog(Base):
    __tablename__ = "qa_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    diary_id: Mapped[int] = mapped_column(ForeignKey("diaries.id"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pytest tests/test_models.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add app/models.py tests/test_models.py
git commit -m "feat(backend): add 6 SQLAlchemy models (users/family/clips/diaries/comments/qa_logs)"
```

---

## Task 5: Pydantic schemas

**Files:**
- Create: `backend/app/schemas.py`
- Create: `backend/tests/test_schemas.py`

- [ ] **Step 1: 写失败的 schema 测试**

Create `backend/tests/test_schemas.py`:

```python
from datetime import datetime, date
from app.schemas import (
    IngestClipIn, IngestSocialIn, ClipOut,
    DiaryOut, DiaryParagraph, DiaryPatchIn,
    CommentIn, CommentOut, AskIn, AskOut,
)
from datetime import date


def test_ingest_clip_in_parses():
    data = IngestClipIn(
        source="camera",
        file_path="/tmp/v.mp4",
        captured_at=datetime(2026, 5, 2, 14, 0),
    )
    assert data.source == "camera"


def test_ingest_social_in_parses():
    data = IngestSocialIn(
        content="今天好累",
        captured_at=datetime(2026, 5, 2, 20, 0),
    )
    assert data.content == "今天好累"


def test_diary_paragraph_defaults_hidden_false():
    p = DiaryParagraph(id="p1", text="今天...", source_clip_ids=[1])
    assert p.hidden is False


def test_diary_patch_in_accepts_partial():
    patch = DiaryPatchIn(
        title="新标题",
        paragraphs=[DiaryParagraph(id="p1", text="改过", source_clip_ids=[], hidden=True)],
    )
    assert patch.title == "新标题"
    assert patch.paragraphs[0].hidden is True


def test_ask_in_requires_text():
    req = AskIn(question="他几点回家？", author_id=1)
    assert req.question == "他几点回家？"
    assert req.author_id == 1


def test_diary_out_comments_default_empty():
    out = DiaryOut(
        id=1, date=date(2026, 5, 2), status="draft", title="t",
        paragraphs=[], cover_images=[], published_at=None,
    )
    assert out.comments == []
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pytest tests/test_schemas.py -v`
Expected: `ImportError: cannot import name 'IngestClipIn'`

- [ ] **Step 3: 写 schemas.py**

Create `backend/app/schemas.py`:

```python
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


class IngestClipIn(BaseModel):
    source: str = Field(pattern="^(camera|social)$")
    file_path: str
    captured_at: datetime
    auto_caption: Optional[str] = None


class IngestSocialIn(BaseModel):
    content: str
    captured_at: datetime
    image_urls: list[str] = Field(default_factory=list)


class ClipOut(BaseModel):
    id: int
    source: str
    file_path: str
    captured_at: datetime
    auto_caption: Optional[str]
    visibility: str


class DiaryParagraph(BaseModel):
    id: str
    text: str
    source_clip_ids: list[int] = Field(default_factory=list)
    hidden: bool = False


class CommentIn(BaseModel):
    author_id: int
    content: str
    audio_url: Optional[str] = None


class CommentOut(BaseModel):
    id: int
    diary_id: int
    author_id: int
    content: str
    audio_url: Optional[str]
    created_at: datetime


class DiaryOut(BaseModel):
    id: int
    date: date
    status: str
    title: str
    paragraphs: list[DiaryParagraph]
    cover_images: list[str]
    published_at: Optional[datetime]
    comments: list[CommentOut] = Field(default_factory=list)


class DiaryPatchIn(BaseModel):
    title: Optional[str] = None
    paragraphs: Optional[list[DiaryParagraph]] = None


class AskIn(BaseModel):
    question: str
    author_id: int


class AskOut(BaseModel):
    intent: str  # "question" | "comment"
    answer: Optional[str] = None
    comment_id: Optional[int] = None
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pytest tests/test_schemas.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add app/schemas.py tests/test_schemas.py
git commit -m "feat(backend): add Pydantic request/response schemas"
```

---

## Task 6: pytest 公共 fixture

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_conftest_smoke.py`

- [ ] **Step 1: 写失败的 fixture 冒烟测试**

Create `backend/tests/test_conftest_smoke.py`:

```python
from app.models import User, Family


def test_db_session_fixture_works(db_session):
    u = User(role="junior", name="smoke")
    db_session.add(u)
    db_session.flush()
    assert u.id is not None


def test_demo_family_fixture_creates_pair(demo_family, db_session):
    junior, senior, family = demo_family
    assert junior.role == "junior"
    assert senior.role == "senior"
    assert junior.family_id == family.id


def test_client_fixture_health(client):
    r = client.get("/health")
    assert r.status_code == 200
```

- [ ] **Step 2: 写 conftest.py**

Create `backend/tests/conftest.py`:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import engine_for_url
from app.main import app
from app.models import Base, User, Family


@pytest.fixture
def engine():
    eng = engine_for_url("sqlite:///:memory:")
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def db_session(engine):
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
        session.commit()
    finally:
        session.close()


@pytest.fixture
def demo_family(db_session):
    junior = User(role="junior", name="小明")
    senior = User(role="senior", name="妈妈")
    db_session.add_all([junior, senior])
    db_session.flush()
    family = Family(junior_user_id=junior.id, senior_user_id=senior.id)
    db_session.add(family)
    db_session.flush()
    junior.family_id = family.id
    senior.family_id = family.id
    db_session.flush()
    return junior, senior, family


@pytest.fixture
def client(engine):
    app.state.test_engine = engine
    with TestClient(app) as c:
        yield c
    if hasattr(app.state, "test_engine"):
        delattr(app.state, "test_engine")
```

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_conftest_smoke.py -v`
Expected: 3 passed

- [ ] **Step 4: Commit**

```bash
git add tests/conftest.py tests/test_conftest_smoke.py
git commit -m "test(backend): add shared pytest fixtures (db_session, demo_family, client)"
```

---

## Task 7: FFmpeg 抽帧 service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/frame_extractor.py`
- Create: `backend/tests/fixtures/sample.mp4`（用 ffmpeg 生成一段 2 秒的纯色测试视频）
- Create: `backend/tests/test_frame_extractor.py`

- [ ] **Step 1: 生成测试用 sample.mp4**

Run (一次性，生成 fixture)：

```bash
mkdir -p tests/fixtures
ffmpeg -f lavfi -i "color=c=red:size=320x240:d=2" -y tests/fixtures/sample.mp4
```

Expected: `tests/fixtures/sample.mp4` 存在，ffprobe 可读。

- [ ] **Step 2: 写失败的 frame_extractor 测试**

Create `backend/tests/test_frame_extractor.py`:

```python
from pathlib import Path
import pytest

from app.services.frame_extractor import extract_keyframes


def test_extract_keyframes_returns_image_paths(tmp_path):
    sample = Path(__file__).parent / "fixtures" / "sample.mp4"
    frames = extract_keyframes(
        video_path=str(sample),
        output_dir=str(tmp_path),
        every_n_seconds=1,
        ffmpeg_bin="ffmpeg",
    )
    assert len(frames) >= 1
    for f in frames:
        assert Path(f).exists()
        assert f.endswith(".jpg")


def test_extract_keyframes_missing_video_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        extract_keyframes(
            video_path="/does/not/exist.mp4",
            output_dir=str(tmp_path),
            every_n_seconds=1,
            ffmpeg_bin="ffmpeg",
        )
```

- [ ] **Step 3: 运行测试验证失败**

Run: `pytest tests/test_frame_extractor.py -v`
Expected: `ModuleNotFoundError: No module named 'app.services.frame_extractor'`

- [ ] **Step 4: 写 frame_extractor.py**

Create `backend/app/services/__init__.py`: (empty)

Create `backend/app/services/frame_extractor.py`:

```python
import subprocess
from pathlib import Path
from uuid import uuid4


def extract_keyframes(
    video_path: str,
    output_dir: str,
    every_n_seconds: int = 2,
    ffmpeg_bin: str = "ffmpeg",
) -> list[str]:
    """Extract one frame every N seconds; return list of JPG paths."""
    video = Path(video_path)
    if not video.exists():
        raise FileNotFoundError(f"video not found: {video_path}")

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    prefix = uuid4().hex[:8]

    cmd = [
        ffmpeg_bin, "-hide_banner", "-loglevel", "error",
        "-i", str(video),
        "-vf", f"fps=1/{every_n_seconds}",
        "-q:v", "2",
        str(out / f"{prefix}_%03d.jpg"),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr}")

    return sorted(str(p) for p in out.glob(f"{prefix}_*.jpg"))
```

- [ ] **Step 5: 运行测试验证通过**

Run: `pytest tests/test_frame_extractor.py -v`
Expected: 2 passed

**注意：** 需本机已安装 ffmpeg 并在 PATH 中。

- [ ] **Step 6: Commit**

```bash
git add app/services/__init__.py app/services/frame_extractor.py tests/test_frame_extractor.py tests/fixtures/sample.mp4
git commit -m "feat(backend): add FFmpeg frame extractor service"
```

---

## Task 8: 视觉描述 service

**Files:**
- Create: `backend/app/services/vision.py`
- Create: `backend/tests/test_vision.py`

- [ ] **Step 1: 写失败的 vision 测试（用 Fake client 注入）**

Create `backend/tests/test_vision.py`:

```python
from app.services.vision import caption_image, VisionClient


class FakeVisionClient:
    def __init__(self, caption="小明在吃火锅"):
        self.caption = caption
        self.calls = []

    def describe(self, image_b64: str, prompt: str) -> str:
        self.calls.append((image_b64[:10], prompt))
        return self.caption


def test_caption_image_reads_file_and_calls_client(tmp_path):
    img = tmp_path / "fake.jpg"
    img.write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 100)  # minimal jpg bytes
    fake = FakeVisionClient("一张红色的图")

    caption = caption_image(str(img), fake)

    assert caption == "一张红色的图"
    assert len(fake.calls) == 1


def test_caption_image_missing_file_raises(tmp_path):
    fake = FakeVisionClient()
    import pytest
    with pytest.raises(FileNotFoundError):
        caption_image(str(tmp_path / "nope.jpg"), fake)
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pytest tests/test_vision.py -v`
Expected: import error

- [ ] **Step 3: 写 vision.py**

Create `backend/app/services/vision.py`:

```python
import base64
from pathlib import Path
from typing import Protocol


class VisionClient(Protocol):
    def describe(self, image_b64: str, prompt: str) -> str: ...


class AnthropicVisionClient:
    """Real adapter around anthropic SDK."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def describe(self, image_b64: str, prompt: str) -> str:
        resp = self._client.messages.create(
            model=self._model,
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {
                        "type": "base64", "media_type": "image/jpeg", "data": image_b64,
                    }},
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return resp.content[0].text


DEFAULT_PROMPT = (
    "这张照片来自一个年轻人日常生活的 Insta360 相机。"
    "用一句中文描述画面里发生了什么（人、场景、动作）。不要推测情绪。"
)


def caption_image(image_path: str, client: VisionClient, prompt: str = DEFAULT_PROMPT) -> str:
    p = Path(image_path)
    if not p.exists():
        raise FileNotFoundError(image_path)
    b64 = base64.b64encode(p.read_bytes()).decode("ascii")
    return client.describe(b64, prompt)
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pytest tests/test_vision.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add app/services/vision.py tests/test_vision.py
git commit -m "feat(backend): add vision caption service with pluggable client"
```

---

## Task 9: POST /ingest/clip

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/ingest.py`
- Modify: `backend/app/main.py` （挂路由 + 初始化 engine）
- Create: `backend/tests/test_ingest.py`

- [ ] **Step 1: 写失败的 /ingest/clip 测试**

Create `backend/tests/test_ingest.py`:

```python
from datetime import datetime


def test_ingest_clip_creates_row(client, demo_family):
    junior, senior, family = demo_family
    payload = {
        "source": "camera",
        "file_path": "/tmp/clip1.mp4",
        "captured_at": "2026-05-02T14:30:00",
        "auto_caption": "小明走在街上",
    }
    r = client.post("/ingest/clip", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["id"] > 0
    assert body["visibility"] == "visible"
    assert body["source"] == "camera"


def test_ingest_clip_rejects_bad_source(client, demo_family):
    payload = {
        "source": "invalid",
        "file_path": "/tmp/x.mp4",
        "captured_at": "2026-05-02T14:30:00",
    }
    r = client.post("/ingest/clip", json=payload)
    assert r.status_code == 422
```

- [ ] **Step 2: 写 ingest 路由 + main.py 接线**

Create `backend/app/routers/__init__.py`: (empty)

Create `backend/app/routers/ingest.py`:

```python
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import session_scope
from app.models import RawClip
from app.schemas import IngestClipIn, ClipOut, IngestSocialIn

router = APIRouter(prefix="/ingest", tags=["ingest"])


def _engine_from_request(request: Request):
    return request.app.state.test_engine if hasattr(request.app.state, "test_engine") else request.app.state.engine


@router.post("/clip", response_model=ClipOut, status_code=201)
def ingest_clip(payload: IngestClipIn, request: Request):
    engine = _engine_from_request(request)
    with session_scope(engine) as s:
        clip = RawClip(
            source=payload.source,
            file_path=payload.file_path,
            captured_at=payload.captured_at,
            auto_caption=payload.auto_caption,
        )
        s.add(clip)
        s.flush()
        return ClipOut(
            id=clip.id, source=clip.source, file_path=clip.file_path,
            captured_at=clip.captured_at, auto_caption=clip.auto_caption,
            visibility=clip.visibility,
        )
```

Update `backend/app/main.py`:

```python
from fastapi import FastAPI

from app.db import engine_for_url
from app.models import Base
from app.routers import ingest as ingest_router

app = FastAPI(title="AI 家庭日记 API")


@app.on_event("startup")
def _startup():
    if not hasattr(app.state, "test_engine"):
        engine = engine_for_url("sqlite:///./data/app.db")
        Base.metadata.create_all(engine)
        app.state.engine = engine


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(ingest_router.router)
```

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_ingest.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add app/main.py app/routers/__init__.py app/routers/ingest.py tests/test_ingest.py
git commit -m "feat(backend): POST /ingest/clip writes raw_clips row"
```

---

## Task 9b: 接通 `/ingest/clip` 的"无 caption 自动跑视觉"分支

**Files:**
- Modify: `backend/app/routers/ingest.py`
- Modify: `backend/tests/test_ingest.py`

**Why:** Spec §6.2 ① 明确要求：硬件传视频但没传 `auto_caption` 时，服务端要自己跑 FFmpeg 抽帧 + 视觉模型生成描述；带了 `auto_caption` 就跳过。Task 7（frame_extractor）和 Task 8（vision）已经写好，这一步把它们接进 ingest 端点。

- [ ] **Step 1: 写失败测试（验证无 caption 触发 vision）**

Append to `backend/tests/test_ingest.py`:

```python
def test_ingest_clip_without_caption_calls_vision(client, demo_family, monkeypatch, tmp_path):
    # 用真 ffmpeg 抽帧需要真视频；此处把 frame_extractor + vision 都注入 fake
    fake_calls = {"frames": [], "captions": []}

    def fake_extract(video_path, output_dir, every_n_seconds, ffmpeg_bin):
        fake_calls["frames"].append(video_path)
        # 模拟产出一帧
        f = tmp_path / "frame.jpg"
        f.write_bytes(b"\xff\xd8\xff\xe0")
        return [str(f)]

    def fake_caption(image_path, client, prompt=None):
        fake_calls["captions"].append(image_path)
        return "小明走在三里屯"

    from app.routers import ingest as ingest_router
    monkeypatch.setattr(ingest_router, "extract_keyframes", fake_extract)
    monkeypatch.setattr(ingest_router, "caption_image", fake_caption)
    monkeypatch.setattr(ingest_router, "get_vision_client", lambda: object())

    payload = {
        "source": "camera",
        "file_path": "/tmp/clip2.mp4",
        "captured_at": "2026-05-02T15:00:00",
        # no auto_caption -> should trigger vision
    }
    r = client.post("/ingest/clip", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["auto_caption"] == "小明走在三里屯"
    assert len(fake_calls["frames"]) == 1
    assert len(fake_calls["captions"]) == 1


def test_ingest_clip_with_caption_skips_vision(client, demo_family, monkeypatch):
    called = {"vision": 0}

    def fake_extract(*a, **k):
        called["vision"] += 1
        return []

    def fake_caption(*a, **k):
        called["vision"] += 1
        return "x"

    from app.routers import ingest as ingest_router
    monkeypatch.setattr(ingest_router, "extract_keyframes", fake_extract)
    monkeypatch.setattr(ingest_router, "caption_image", fake_caption)

    payload = {
        "source": "camera",
        "file_path": "/tmp/clip3.mp4",
        "captured_at": "2026-05-02T16:00:00",
        "auto_caption": "前端已经写好了",
    }
    r = client.post("/ingest/clip", json=payload)
    assert r.status_code == 201
    assert r.json()["auto_caption"] == "前端已经写好了"
    assert called["vision"] == 0
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pytest tests/test_ingest.py::test_ingest_clip_without_caption_calls_vision -v`
Expected: 测试报 AttributeError 或 caption 是 None

- [ ] **Step 3: 改造 ingest 路由接通 vision pipeline**

Replace the ingest_clip handler in `backend/app/routers/ingest.py` (keep ingest_social as-is):

```python
import tempfile
from pathlib import Path

from app.config import get_settings
from app.services.frame_extractor import extract_keyframes
from app.services.vision import caption_image, AnthropicVisionClient


def get_vision_client():
    """Overridable in tests via monkeypatch."""
    return AnthropicVisionClient(api_key=get_settings().anthropic_api_key)


def _auto_caption_from_video(file_path: str) -> str:
    """抽 1-3 帧，每帧描述一句，拼成一段。失败时返回空串（让上游决定如何处理）。"""
    try:
        settings = get_settings()
        with tempfile.TemporaryDirectory(dir=settings.data_dir if Path(settings.data_dir).exists() else None) as tmp:
            frames = extract_keyframes(
                video_path=file_path,
                output_dir=tmp,
                every_n_seconds=2,
                ffmpeg_bin=settings.ffmpeg_bin,
            )
            client = get_vision_client()
            captions = [caption_image(f, client) for f in frames[:3]]
        return " ".join(c for c in captions if c).strip()
    except Exception as e:
        # 24h demo 容错：vision 失败不阻塞入库，留给小辈手动补
        return f"[视觉描述失败: {type(e).__name__}]"


@router.post("/clip", response_model=ClipOut, status_code=201)
def ingest_clip(payload: IngestClipIn, request: Request):
    engine = _engine_from_request(request)

    auto_caption = payload.auto_caption
    if not auto_caption and payload.source == "camera":
        auto_caption = _auto_caption_from_video(payload.file_path)

    with session_scope(engine) as s:
        clip = RawClip(
            source=payload.source,
            file_path=payload.file_path,
            captured_at=payload.captured_at,
            auto_caption=auto_caption,
        )
        s.add(clip); s.flush()
        return ClipOut(
            id=clip.id, source=clip.source, file_path=clip.file_path,
            captured_at=clip.captured_at, auto_caption=clip.auto_caption,
            visibility=clip.visibility,
        )
```

- [ ] **Step 4: 运行所有 ingest 测试验证通过**

Run: `pytest tests/test_ingest.py -v`
Expected: 5 passed（原 3 个 + 新 2 个）

- [ ] **Step 5: Commit**

```bash
git add app/routers/ingest.py tests/test_ingest.py
git commit -m "feat(backend): /ingest/clip auto-runs FFmpeg+vision when no caption provided"
```

---

## Task 10: POST /ingest/social

**Files:**
- Modify: `backend/app/routers/ingest.py`
- Modify: `backend/tests/test_ingest.py`

- [ ] **Step 1: 追加失败测试**

Append to `backend/tests/test_ingest.py`:

```python
def test_ingest_social_creates_row(client, demo_family):
    payload = {
        "content": "今天在三里屯，好久没来了",
        "captured_at": "2026-05-02T20:00:00",
        "image_urls": ["http://example.com/1.jpg"],
    }
    r = client.post("/ingest/social", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["source"] == "social"
    assert "今天" in body["auto_caption"]
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pytest tests/test_ingest.py::test_ingest_social_creates_row -v`
Expected: `404 /ingest/social`

- [ ] **Step 3: 实现端点**

Append to `backend/app/routers/ingest.py`:

```python
@router.post("/social", response_model=ClipOut, status_code=201)
def ingest_social(payload: IngestSocialIn, request: Request):
    engine = _engine_from_request(request)
    with session_scope(engine) as s:
        # Social posts 保存为 source='social'，file_path 存第一张图（或空），
        # content 落到 auto_caption 方便后续 LLM 直接用。
        clip = RawClip(
            source="social",
            file_path=payload.image_urls[0] if payload.image_urls else "",
            captured_at=payload.captured_at,
            auto_caption=payload.content,
        )
        s.add(clip)
        s.flush()
        return ClipOut(
            id=clip.id, source=clip.source, file_path=clip.file_path,
            captured_at=clip.captured_at, auto_caption=clip.auto_caption,
            visibility=clip.visibility,
        )
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pytest tests/test_ingest.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add app/routers/ingest.py tests/test_ingest.py
git commit -m "feat(backend): POST /ingest/social writes social post as raw_clip"
```

---

## Task 11: GET /clips

**Files:**
- Create: `backend/app/routers/clips.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_clips.py`

- [ ] **Step 1: 写失败测试**

Create `backend/tests/test_clips.py`:

```python
from datetime import datetime
from app.models import RawClip


def test_get_clips_filters_by_date(client, demo_family, engine):
    from app.db import session_scope
    with session_scope(engine) as s:
        s.add(RawClip(source="camera", file_path="/a.mp4",
                      captured_at=datetime(2026, 5, 2, 10, 0), auto_caption="a"))
        s.add(RawClip(source="camera", file_path="/b.mp4",
                      captured_at=datetime(2026, 5, 1, 10, 0), auto_caption="b"))

    r = client.get("/clips?date=2026-05-02")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["auto_caption"] == "a"


def test_get_clips_excludes_hidden(client, demo_family, engine):
    from app.db import session_scope
    with session_scope(engine) as s:
        s.add(RawClip(source="camera", file_path="/a.mp4",
                      captured_at=datetime(2026, 5, 2, 10, 0), auto_caption="a",
                      visibility="hidden"))
        s.add(RawClip(source="camera", file_path="/b.mp4",
                      captured_at=datetime(2026, 5, 2, 11, 0), auto_caption="b"))

    r = client.get("/clips?date=2026-05-02")
    assert len(r.json()) == 1
    assert r.json()[0]["auto_caption"] == "b"
```

- [ ] **Step 2: 实现路由**

Create `backend/app/routers/clips.py`:

```python
from datetime import date as date_cls, datetime, timedelta
from fastapi import APIRouter, Query, Request

from app.db import session_scope
from app.models import RawClip
from app.schemas import ClipOut

router = APIRouter(prefix="/clips", tags=["clips"])


def _engine_from_request(request):
    return request.app.state.test_engine if hasattr(request.app.state, "test_engine") else request.app.state.engine


@router.get("", response_model=list[ClipOut])
def list_clips(request: Request, date: date_cls = Query(...)):
    engine = _engine_from_request(request)
    start = datetime.combine(date, datetime.min.time())
    end = start + timedelta(days=1)
    with session_scope(engine) as s:
        rows = (
            s.query(RawClip)
            .filter(RawClip.captured_at >= start)
            .filter(RawClip.captured_at < end)
            .filter(RawClip.visibility == "visible")
            .order_by(RawClip.captured_at)
            .all()
        )
        return [
            ClipOut(
                id=r.id, source=r.source, file_path=r.file_path,
                captured_at=r.captured_at, auto_caption=r.auto_caption,
                visibility=r.visibility,
            ) for r in rows
        ]
```

Update `backend/app/main.py`:

```python
from app.routers import ingest as ingest_router, clips as clips_router
# ... (existing code)
app.include_router(ingest_router.router)
app.include_router(clips_router.router)
```

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_clips.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add app/routers/clips.py app/main.py tests/test_clips.py
git commit -m "feat(backend): GET /clips?date= returns visible clips for that day"
```

---

## Task 12: 日记生成 service

**Files:**
- Create: `backend/app/services/diary_generator.py`
- Create: `backend/tests/test_diary_generator.py`

- [ ] **Step 1: 写失败的 diary_generator 测试**

Create `backend/tests/test_diary_generator.py`:

```python
from datetime import datetime
from app.services.diary_generator import generate_diary, DiaryLLMClient


class FakeDiaryClient:
    def __init__(self, response):
        self.response = response
        self.last_prompt = None

    def generate(self, prompt: str) -> str:
        self.last_prompt = prompt
        return self.response


def _clips():
    return [
        {"id": 1, "source": "camera", "auto_caption": "小明走在三里屯",
         "captured_at": datetime(2026, 5, 2, 12, 0)},
        {"id": 2, "source": "camera", "auto_caption": "小明和两个朋友吃火锅",
         "captured_at": datetime(2026, 5, 2, 13, 0)},
        {"id": 3, "source": "social", "auto_caption": "太辣了！",
         "captured_at": datetime(2026, 5, 2, 13, 30)},
    ]


def test_generate_diary_returns_parsed_structure():
    fake_resp = """{
      "title": "小明的一天",
      "paragraphs": [
        {"id": "p1", "text": "今天小明去了三里屯。", "source_clip_ids": [1]},
        {"id": "p2", "text": "和朋友吃了麻辣火锅。", "source_clip_ids": [2, 3]}
      ],
      "cover_clip_ids": [1, 2]
    }"""
    client = FakeDiaryClient(fake_resp)

    diary = generate_diary(_clips(), client)

    assert diary["title"] == "小明的一天"
    assert len(diary["paragraphs"]) == 2
    assert diary["paragraphs"][0]["id"] == "p1"
    assert diary["cover_clip_ids"] == [1, 2]


def test_generate_diary_includes_captions_in_prompt():
    client = FakeDiaryClient('{"title":"t","paragraphs":[],"cover_clip_ids":[]}')
    generate_diary(_clips(), client)
    assert "小明走在三里屯" in client.last_prompt
    assert "小明和两个朋友吃火锅" in client.last_prompt


def test_generate_diary_raises_on_invalid_json():
    client = FakeDiaryClient("not json at all")
    import pytest
    with pytest.raises(ValueError, match="diary JSON"):
        generate_diary(_clips(), client)
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pytest tests/test_diary_generator.py -v`
Expected: import error

- [ ] **Step 3: 写 diary_generator.py**

Create `backend/app/services/diary_generator.py`:

```python
import json
from typing import Protocol


class DiaryLLMClient(Protocol):
    def generate(self, prompt: str) -> str: ...


class AnthropicDiaryClient:
    """Real adapter around anthropic SDK."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def generate(self, prompt: str) -> str:
        resp = self._client.messages.create(
            model=self._model,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text


FEW_SHOT_EXAMPLES = """
示例 1（目标语感）：
{
  "title": "小雨的周六",
  "paragraphs": [
    {"id": "p1", "text": "小雨今天难得睡了懒觉，中午才起。", "source_clip_ids": [1]},
    {"id": "p2", "text": "下午去朝阳公园走了走，阳光很好。", "source_clip_ids": [2, 3]}
  ],
  "cover_clip_ids": [2, 3]
}
""".strip()


SYSTEM_INSTRUCTION = """
你是一位温暖的家人，每天把一个年轻人的 Insta360 视频描述和社媒动态，
合成一篇给 TA 爸妈看的中文日记。

规则：
- 第三人称，叙事平实，不要夸张修辞。
- 2-5 段，每段一个清晰场景，每段 40-80 字。
- 不要推测情绪或杜撰细节，只根据素材描述如实写。
- 每段必须附 source_clip_ids，表明由哪些素材合成。
- cover_clip_ids 挑 3-5 个视觉最具代表性的。
- 严格输出 JSON，不要任何前后文。

只输出 JSON：
{
  "title": "...",
  "paragraphs": [{"id":"p1","text":"...","source_clip_ids":[...]}],
  "cover_clip_ids":[...]
}
"""


def _build_prompt(clips: list[dict]) -> str:
    captions_block = "\n".join(
        f"- clip_id={c['id']} [{c['source']}] {c['captured_at'].isoformat()}: {c['auto_caption']}"
        for c in clips
    )
    return (
        SYSTEM_INSTRUCTION
        + "\n\n" + FEW_SHOT_EXAMPLES
        + "\n\n今天的素材：\n" + captions_block
        + "\n\n生成 JSON："
    )


def generate_diary(clips: list[dict], client: DiaryLLMClient) -> dict:
    if not clips:
        return {"title": "今天没有素材", "paragraphs": [], "cover_clip_ids": []}

    prompt = _build_prompt(clips)
    raw = client.generate(prompt)

    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"invalid diary JSON: {raw[:200]}")
    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError as e:
        raise ValueError(f"invalid diary JSON: {e}") from e

    return data
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pytest tests/test_diary_generator.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add app/services/diary_generator.py tests/test_diary_generator.py
git commit -m "feat(backend): diary generator service with few-shot prompt"
```

---

## Task 13: POST /diary/generate

**Files:**
- Create: `backend/app/routers/diary.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_diary_generate.py`

- [ ] **Step 1: 写失败的 generate 测试**

Create `backend/tests/test_diary_generate.py`:

```python
from datetime import datetime, date
from app.models import RawClip, Diary
from app.db import session_scope


def _seed_clips(engine):
    with session_scope(engine) as s:
        s.add(RawClip(source="camera", file_path="/1.mp4",
                      captured_at=datetime(2026, 5, 2, 12, 0),
                      auto_caption="小明走在三里屯"))
        s.add(RawClip(source="camera", file_path="/2.mp4",
                      captured_at=datetime(2026, 5, 2, 13, 0),
                      auto_caption="小明和朋友吃火锅"))


class FakeDiaryClient:
    def generate(self, prompt):
        return '{"title":"小明的一天","paragraphs":[{"id":"p1","text":"去了三里屯","source_clip_ids":[1]}],"cover_clip_ids":[1]}'


def test_generate_diary_creates_draft_row(client, demo_family, engine, monkeypatch):
    _seed_clips(engine)
    from app.routers import diary as diary_router
    monkeypatch.setattr(diary_router, "get_diary_client", lambda: FakeDiaryClient())

    r = client.post("/diary/generate", json={"date": "2026-05-02"})
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "draft"
    assert body["title"] == "小明的一天"
    assert len(body["paragraphs"]) == 1

    with session_scope(engine) as s:
        assert s.query(Diary).count() == 1


def test_generate_diary_skips_hidden_clips(client, demo_family, engine, monkeypatch):
    captured_prompts = []

    class RecordingClient:
        def generate(self, prompt):
            captured_prompts.append(prompt)
            return '{"title":"t","paragraphs":[],"cover_clip_ids":[]}'

    from app.routers import diary as diary_router
    monkeypatch.setattr(diary_router, "get_diary_client", lambda: RecordingClient())

    with session_scope(engine) as s:
        s.add(RawClip(source="camera", file_path="/v.mp4",
                      captured_at=datetime(2026, 5, 2, 12, 0),
                      auto_caption="酒吧的素材",
                      visibility="hidden"))
        s.add(RawClip(source="camera", file_path="/w.mp4",
                      captured_at=datetime(2026, 5, 2, 13, 0),
                      auto_caption="吃饭的素材"))

    client.post("/diary/generate", json={"date": "2026-05-02"})
    assert "酒吧的素材" not in captured_prompts[0]
    assert "吃饭的素材" in captured_prompts[0]
```

- [ ] **Step 2: 写 diary router**

Create `backend/app/routers/diary.py`:

```python
from datetime import date as date_cls, datetime, timedelta
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.db import session_scope
from app.models import Diary, Family, RawClip
from app.schemas import DiaryOut, DiaryParagraph
from app.services.diary_generator import generate_diary, AnthropicDiaryClient

router = APIRouter(prefix="/diary", tags=["diary"])


def get_diary_client():
    """Overridable in tests via monkeypatch."""
    return AnthropicDiaryClient(api_key=get_settings().anthropic_api_key)


def _engine_from_request(request):
    return request.app.state.test_engine if hasattr(request.app.state, "test_engine") else request.app.state.engine


class GenerateIn(BaseModel):
    date: date_cls


def _to_out(d: Diary) -> DiaryOut:
    return DiaryOut(
        id=d.id, date=d.date, status=d.status, title=d.title,
        paragraphs=[DiaryParagraph(**p) for p in (d.body_json or [])],
        cover_images=d.cover_images_json or [],
        published_at=d.published_at,
    )


@router.post("/generate", response_model=DiaryOut, status_code=201)
def generate(payload: GenerateIn, request: Request):
    engine = _engine_from_request(request)
    start = datetime.combine(payload.date, datetime.min.time())
    end = start + timedelta(days=1)

    with session_scope(engine) as s:
        fam = s.query(Family).first()
        if not fam:
            raise HTTPException(500, "no family configured")

        clips = (
            s.query(RawClip)
            .filter(RawClip.captured_at >= start)
            .filter(RawClip.captured_at < end)
            .filter(RawClip.visibility == "visible")
            .order_by(RawClip.captured_at)
            .all()
        )
        clip_dicts = [
            {"id": c.id, "source": c.source,
             "auto_caption": c.auto_caption or "", "captured_at": c.captured_at}
            for c in clips
        ]

        llm = get_diary_client()
        generated = generate_diary(clip_dicts, llm)

        # Resolve cover_clip_ids → file_path
        cover_ids = generated.get("cover_clip_ids", [])
        id_to_path = {c.id: c.file_path for c in clips}
        covers = [id_to_path[i] for i in cover_ids if i in id_to_path]

        paragraphs = [
            {"id": p["id"], "text": p["text"],
             "source_clip_ids": p.get("source_clip_ids", []), "hidden": False}
            for p in generated.get("paragraphs", [])
        ]

        d = Diary(
            family_id=fam.id,
            date=payload.date,
            status="draft",
            title=generated.get("title", "今日日记"),
            body_json=paragraphs,
            cover_images_json=covers,
        )
        s.add(d)
        s.flush()
        return _to_out(d)
```

Update `backend/app/main.py` to include `diary_router`.

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_diary_generate.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add app/routers/diary.py app/main.py tests/test_diary_generate.py
git commit -m "feat(backend): POST /diary/generate produces draft diary from visible clips"
```

---

## Task 14: GET /diary/today

**Files:**
- Modify: `backend/app/routers/diary.py`
- Create: `backend/tests/test_diary_today.py`

- [ ] **Step 1: 写失败测试**

Create `backend/tests/test_diary_today.py`:

```python
from datetime import date, datetime
from app.models import Diary
from app.db import session_scope


def _seed_diary(engine, family_id, status):
    with session_scope(engine) as s:
        d = Diary(
            family_id=family_id,
            date=date.today(),
            status=status,
            title="t",
            body_json=[
                {"id": "p1", "text": "public", "source_clip_ids": [], "hidden": False},
                {"id": "p2", "text": "secret", "source_clip_ids": [], "hidden": True},
            ],
            cover_images_json=["/a.jpg"],
            published_at=datetime.utcnow() if status == "published" else None,
        )
        s.add(d)


def test_today_junior_sees_all_paragraphs(client, demo_family, engine):
    _, _, fam = demo_family
    _seed_diary(engine, fam.id, "draft")
    r = client.get("/diary/today?role=junior")
    assert r.status_code == 200
    paragraphs = r.json()["paragraphs"]
    assert len(paragraphs) == 2


def test_today_junior_includes_comments(client, demo_family, engine):
    junior, senior, fam = demo_family
    _seed_diary(engine, fam.id, "published")
    from app.models import Comment
    with session_scope(engine) as s:
        d = s.query(Diary).first()
        s.add(Comment(diary_id=d.id, author_id=senior.id, content="想你了"))
        s.add(Comment(diary_id=d.id, author_id=senior.id, content="吃饱点"))

    r = client.get("/diary/today?role=junior")
    assert r.status_code == 200
    comments = r.json()["comments"]
    assert len(comments) == 2
    assert comments[0]["content"] == "想你了"


def test_today_senior_excludes_comments_field_or_empty(client, demo_family, engine):
    """长辈看自己说过的话没意义，comments 留空（也可以由前端忽略）"""
    junior, senior, fam = demo_family
    _seed_diary(engine, fam.id, "published")
    from app.models import Comment
    with session_scope(engine) as s:
        d = s.query(Diary).first()
        s.add(Comment(diary_id=d.id, author_id=senior.id, content="x"))

    r = client.get("/diary/today?role=senior")
    assert r.status_code == 200
    assert r.json()["comments"] == []


def test_today_senior_gets_404_if_not_published(client, demo_family, engine):
    _, _, fam = demo_family
    _seed_diary(engine, fam.id, "draft")
    r = client.get("/diary/today?role=senior")
    assert r.status_code == 404


def test_today_senior_sees_published_without_hidden(client, demo_family, engine):
    _, _, fam = demo_family
    _seed_diary(engine, fam.id, "published")
    r = client.get("/diary/today?role=senior")
    assert r.status_code == 200
    paragraphs = r.json()["paragraphs"]
    assert len(paragraphs) == 1
    assert paragraphs[0]["text"] == "public"
```

- [ ] **Step 2: 实现 /today**

Append to `backend/app/routers/diary.py`:

```python
from fastapi import Query


@router.get("/today", response_model=DiaryOut)
def get_today(request: Request, role: str = Query(..., pattern="^(junior|senior)$")):
    engine = _engine_from_request(request)
    today = date_cls.today()
    with session_scope(engine) as s:
        q = s.query(Diary).filter(Diary.date == today)
        if role == "senior":
            q = q.filter(Diary.status == "published")
        d = q.order_by(Diary.id.desc()).first()
        if not d:
            raise HTTPException(404, "no diary for today")

        out = _to_out(d)

        if role == "junior":
            from app.models import Comment
            from app.schemas import CommentOut
            comments = (
                s.query(Comment)
                .filter(Comment.diary_id == d.id)
                .order_by(Comment.created_at)
                .all()
            )
            out.comments = [
                CommentOut(
                    id=c.id, diary_id=c.diary_id, author_id=c.author_id,
                    content=c.content, audio_url=c.audio_url, created_at=c.created_at,
                ) for c in comments
            ]
        else:  # senior
            out.paragraphs = [p for p in out.paragraphs if not p.hidden]
            # comments 留空：长辈看自己写的留言无意义

        return out
```

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_diary_today.py -v`
Expected: 5 passed

- [ ] **Step 4: Commit**

```bash
git add app/routers/diary.py tests/test_diary_today.py
git commit -m "feat(backend): GET /diary/today with role-based visibility"
```

---

## Task 15: PATCH /diary/:id（段落可见性）

**Files:**
- Modify: `backend/app/routers/diary.py`
- Create: `backend/tests/test_diary_edit.py`

- [ ] **Step 1: 写失败测试**

Create `backend/tests/test_diary_edit.py`:

```python
from datetime import date
from app.models import Diary
from app.db import session_scope


def _seed_draft(engine, family_id):
    with session_scope(engine) as s:
        d = Diary(
            family_id=family_id, date=date.today(), status="draft", title="原标题",
            body_json=[
                {"id": "p1", "text": "段一", "source_clip_ids": [1], "hidden": False},
                {"id": "p2", "text": "段二", "source_clip_ids": [2], "hidden": False},
            ],
            cover_images_json=[],
        )
        s.add(d); s.flush()
        return d.id


def test_patch_hides_paragraph(client, demo_family, engine):
    _, _, fam = demo_family
    diary_id = _seed_draft(engine, fam.id)

    payload = {
        "paragraphs": [
            {"id": "p1", "text": "段一", "source_clip_ids": [1], "hidden": False},
            {"id": "p2", "text": "段二", "source_clip_ids": [2], "hidden": True},
        ]
    }
    r = client.patch(f"/diary/{diary_id}", json=payload)
    assert r.status_code == 200
    paragraphs = r.json()["paragraphs"]
    assert paragraphs[1]["hidden"] is True


def test_patch_updates_title(client, demo_family, engine):
    _, _, fam = demo_family
    diary_id = _seed_draft(engine, fam.id)
    r = client.patch(f"/diary/{diary_id}", json={"title": "新标题"})
    assert r.json()["title"] == "新标题"


def test_patch_rejects_published(client, demo_family, engine):
    _, _, fam = demo_family
    with session_scope(engine) as s:
        d = Diary(family_id=fam.id, date=date.today(), status="published",
                  title="t", body_json=[], cover_images_json=[])
        s.add(d); s.flush()
        diary_id = d.id

    r = client.patch(f"/diary/{diary_id}", json={"title": "x"})
    assert r.status_code == 409
```

- [ ] **Step 2: 实现 PATCH**

Append to `backend/app/routers/diary.py`:

```python
from app.schemas import DiaryPatchIn


@router.patch("/{diary_id}", response_model=DiaryOut)
def patch_diary(diary_id: int, payload: DiaryPatchIn, request: Request):
    engine = _engine_from_request(request)
    with session_scope(engine) as s:
        d = s.get(Diary, diary_id)
        if not d:
            raise HTTPException(404, "diary not found")
        if d.status == "published":
            raise HTTPException(409, "cannot edit published diary")

        if payload.title is not None:
            d.title = payload.title
        if payload.paragraphs is not None:
            d.body_json = [p.model_dump() for p in payload.paragraphs]
        s.flush()
        return _to_out(d)
```

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_diary_edit.py -v`
Expected: 3 passed

- [ ] **Step 4: Commit**

```bash
git add app/routers/diary.py tests/test_diary_edit.py
git commit -m "feat(backend): PATCH /diary/:id supports title and paragraph hiding"
```

---

## Task 16: POST /diary/:id/publish

**Files:**
- Modify: `backend/app/routers/diary.py`
- Create: `backend/tests/test_diary_publish.py`

- [ ] **Step 1: 写失败测试**

Create `backend/tests/test_diary_publish.py`:

```python
from datetime import date
from app.models import Diary
from app.db import session_scope


def _seed_draft(engine, fid):
    with session_scope(engine) as s:
        d = Diary(family_id=fid, date=date.today(), status="draft",
                  title="t", body_json=[], cover_images_json=[])
        s.add(d); s.flush()
        return d.id


def test_publish_flips_status_and_timestamp(client, demo_family, engine):
    _, _, fam = demo_family
    did = _seed_draft(engine, fam.id)
    r = client.post(f"/diary/{did}/publish")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "published"
    assert body["published_at"] is not None


def test_publish_is_idempotent_on_published(client, demo_family, engine):
    _, _, fam = demo_family
    did = _seed_draft(engine, fam.id)
    client.post(f"/diary/{did}/publish")
    r = client.post(f"/diary/{did}/publish")
    # allow either idempotent 200 or conflict 409; we pick 409 to signal "already published"
    assert r.status_code == 409
```

- [ ] **Step 2: 实现 publish**

Append to `backend/app/routers/diary.py`:

```python
from datetime import datetime as dt_cls


@router.post("/{diary_id}/publish", response_model=DiaryOut)
def publish_diary(diary_id: int, request: Request):
    engine = _engine_from_request(request)
    with session_scope(engine) as s:
        d = s.get(Diary, diary_id)
        if not d:
            raise HTTPException(404, "diary not found")
        if d.status == "published":
            raise HTTPException(409, "already published")
        d.status = "published"
        d.published_at = dt_cls.utcnow()
        s.flush()
        return _to_out(d)
```

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_diary_publish.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add app/routers/diary.py tests/test_diary_publish.py
git commit -m "feat(backend): POST /diary/:id/publish sets status and published_at"
```

---

## Task 17: GET /diary/history

**Files:**
- Modify: `backend/app/routers/diary.py`
- Create: `backend/tests/test_diary_history.py`

- [ ] **Step 1: 写失败测试**

Create `backend/tests/test_diary_history.py`:

```python
from datetime import date, datetime, timedelta
from app.models import Diary
from app.db import session_scope


def test_history_returns_published_desc(client, demo_family, engine):
    _, _, fam = demo_family
    with session_scope(engine) as s:
        for i in range(3):
            d = Diary(
                family_id=fam.id,
                date=date.today() - timedelta(days=i),
                status="published",
                title=f"day-{i}",
                body_json=[{"id": "p1", "text": "x", "source_clip_ids": [], "hidden": False}],
                cover_images_json=[],
                published_at=datetime.utcnow() - timedelta(days=i),
            )
            s.add(d)
        # plus one draft that should NOT appear
        s.add(Diary(family_id=fam.id, date=date(2026, 1, 1), status="draft",
                    title="draft-old", body_json=[], cover_images_json=[]))

    r = client.get("/diary/history")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 3
    assert items[0]["title"] == "day-0"
    assert items[-1]["title"] == "day-2"


def test_history_respects_limit(client, demo_family, engine):
    _, _, fam = demo_family
    with session_scope(engine) as s:
        for i in range(5):
            s.add(Diary(family_id=fam.id, date=date.today() - timedelta(days=i),
                        status="published", title=f"d{i}",
                        body_json=[], cover_images_json=[],
                        published_at=datetime.utcnow() - timedelta(days=i)))
    r = client.get("/diary/history?limit=2")
    assert len(r.json()) == 2
```

- [ ] **Step 2: 实现 history**

Append to `backend/app/routers/diary.py`:

```python
@router.get("/history", response_model=list[DiaryOut])
def history(request: Request, limit: int = Query(20, ge=1, le=100)):
    engine = _engine_from_request(request)
    with session_scope(engine) as s:
        rows = (
            s.query(Diary)
            .filter(Diary.status == "published")
            .order_by(Diary.published_at.desc())
            .limit(limit)
            .all()
        )
        return [_to_out(d) for d in rows]
```

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_diary_history.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add app/routers/diary.py tests/test_diary_history.py
git commit -m "feat(backend): GET /diary/history lists recent published diaries"
```

---

## Task 18: POST /diary/:id/comment

**Files:**
- Create: `backend/app/routers/interactions.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_interactions_comment.py`

- [ ] **Step 1: 写失败测试**

Create `backend/tests/test_interactions_comment.py`:

```python
from datetime import date
from app.models import Diary, Comment
from app.db import session_scope


def _seed_published_diary(engine, fid):
    with session_scope(engine) as s:
        d = Diary(family_id=fid, date=date.today(), status="published",
                  title="t", body_json=[], cover_images_json=[])
        s.add(d); s.flush()
        return d.id


def test_post_comment_creates_row(client, demo_family, engine):
    junior, senior, fam = demo_family
    did = _seed_published_diary(engine, fam.id)

    r = client.post(
        f"/diary/{did}/comment",
        json={"author_id": senior.id, "content": "想你了"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["content"] == "想你了"
    assert body["author_id"] == senior.id

    with session_scope(engine) as s:
        assert s.query(Comment).count() == 1


def test_post_comment_accepts_audio_url(client, demo_family, engine):
    _, senior, fam = demo_family
    did = _seed_published_diary(engine, fam.id)
    r = client.post(
        f"/diary/{did}/comment",
        json={"author_id": senior.id, "content": "（语音留言）",
              "audio_url": "/audio/m1.wav"},
    )
    assert r.json()["audio_url"] == "/audio/m1.wav"


def test_post_comment_404_for_unknown_diary(client, demo_family):
    _, senior, _ = demo_family
    r = client.post("/diary/9999/comment",
                    json={"author_id": senior.id, "content": "x"})
    assert r.status_code == 404
```

- [ ] **Step 2: 写 interactions 路由**

Create `backend/app/routers/interactions.py`:

```python
from fastapi import APIRouter, Request, HTTPException

from app.db import session_scope
from app.models import Diary, Comment
from app.schemas import CommentIn, CommentOut

router = APIRouter(prefix="/diary", tags=["interactions"])


def _engine_from_request(request):
    return request.app.state.test_engine if hasattr(request.app.state, "test_engine") else request.app.state.engine


@router.post("/{diary_id}/comment", response_model=CommentOut, status_code=201)
def post_comment(diary_id: int, payload: CommentIn, request: Request):
    engine = _engine_from_request(request)
    with session_scope(engine) as s:
        if not s.get(Diary, diary_id):
            raise HTTPException(404, "diary not found")
        c = Comment(
            diary_id=diary_id, author_id=payload.author_id,
            content=payload.content, audio_url=payload.audio_url,
        )
        s.add(c); s.flush()
        return CommentOut(
            id=c.id, diary_id=c.diary_id, author_id=c.author_id,
            content=c.content, audio_url=c.audio_url, created_at=c.created_at,
        )
```

Update `backend/app/main.py` to include `interactions.router`.

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_interactions_comment.py -v`
Expected: 3 passed

- [ ] **Step 4: Commit**

```bash
git add app/routers/interactions.py app/main.py tests/test_interactions_comment.py
git commit -m "feat(backend): POST /diary/:id/comment supports text and audio"
```

---

## Task 19: 意图判定 service

**Files:**
- Create: `backend/app/services/intent_classifier.py`
- Create: `backend/tests/test_intent_classifier.py`

- [ ] **Step 1: 写失败测试**

Create `backend/tests/test_intent_classifier.py`:

```python
from app.services.intent_classifier import classify_intent


class FakeIntentClient:
    def __init__(self, label):
        self.label = label
        self.last_text = None

    def generate(self, prompt: str) -> str:
        self.last_text = prompt
        return self.label


def test_returns_question():
    assert classify_intent("他今天吃什么了？", FakeIntentClient("question")) == "question"


def test_returns_comment():
    assert classify_intent("告诉他我想他了", FakeIntentClient("comment")) == "comment"


def test_falls_back_to_comment_for_unknown_label():
    assert classify_intent("嗯", FakeIntentClient("unknown_garbage")) == "comment"


def test_user_text_appears_in_prompt():
    fake = FakeIntentClient("question")
    classify_intent("他在哪里？", fake)
    assert "他在哪里？" in fake.last_text
```

- [ ] **Step 2: 写 intent_classifier**

Create `backend/app/services/intent_classifier.py`:

```python
from typing import Protocol


class IntentLLMClient(Protocol):
    def generate(self, prompt: str) -> str: ...


PROMPT = """
下面是一位老人对着 AI 家庭日记 app 说的一句话。请判断 TA 的意图：
- 如果是在**提问**（想知道日记里某个细节、想了解情况），输出：question
- 如果是想把这句话**留言**给自己的孩子，输出：comment

只输出 "question" 或 "comment"，不要其他内容。

老人说的话：{text}
"""


def classify_intent(text: str, client: IntentLLMClient) -> str:
    raw = client.generate(PROMPT.format(text=text)).strip().lower()
    if "question" in raw:
        return "question"
    return "comment"
```

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_intent_classifier.py -v`
Expected: 4 passed

- [ ] **Step 4: Commit**

```bash
git add app/services/intent_classifier.py tests/test_intent_classifier.py
git commit -m "feat(backend): add intent classifier (question vs comment)"
```

---

## Task 20: Q&A service

**Files:**
- Create: `backend/app/services/qa.py`
- Create: `backend/tests/test_qa.py`

- [ ] **Step 1: 写失败测试**

Create `backend/tests/test_qa.py`:

```python
from app.services.qa import answer_question


class FakeQAClient:
    def __init__(self, answer):
        self.answer = answer
        self.last_prompt = None

    def generate(self, prompt: str) -> str:
        self.last_prompt = prompt
        return self.answer


def _diary():
    return {
        "title": "小明的一天",
        "paragraphs": [
            {"id": "p1", "text": "小明中午去了三里屯。", "source_clip_ids": [1]},
            {"id": "p2", "text": "和两个朋友吃了麻辣火锅。", "source_clip_ids": [2]},
        ],
    }


def test_answer_uses_diary_context():
    fake = FakeQAClient("和两个朋友一起。")
    ans = answer_question("他和谁去的？", _diary(), fake)
    assert ans == "和两个朋友一起。"
    assert "三里屯" in fake.last_prompt
    assert "麻辣火锅" in fake.last_prompt


def test_answer_returns_graceful_fallback_for_unknown():
    fake = FakeQAClient("日记里没有说这个。")
    ans = answer_question("他今晚几点睡？", _diary(), fake)
    assert ans == "日记里没有说这个。"
```

- [ ] **Step 2: 写 qa.py**

Create `backend/app/services/qa.py`:

```python
from typing import Protocol


class QALLMClient(Protocol):
    def generate(self, prompt: str) -> str: ...


PROMPT = """
下面是今天小辈的家庭日记。长辈针对日记内容问了一个问题。
请**只依据日记**简短回答（中文，一句话，不要编造）。
如果日记里没有答案，就回答："日记里没有说这个。"

【日记标题】{title}
【日记正文】
{body}

【长辈的问题】{question}

你的回答：
"""


def answer_question(question: str, diary: dict, client: QALLMClient) -> str:
    body = "\n".join(p["text"] for p in diary.get("paragraphs", []))
    prompt = PROMPT.format(title=diary.get("title", ""), body=body, question=question)
    return client.generate(prompt).strip()
```

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_qa.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add app/services/qa.py tests/test_qa.py
git commit -m "feat(backend): add Q&A service grounded in diary text"
```

---

## Task 21: POST /diary/:id/ask

**Files:**
- Modify: `backend/app/routers/interactions.py`
- Create: `backend/tests/test_interactions_ask.py`

- [ ] **Step 1: 写失败测试**

Create `backend/tests/test_interactions_ask.py`:

```python
from datetime import date
from app.models import Diary, Comment, QaLog
from app.db import session_scope


def _seed_published(engine, fid):
    with session_scope(engine) as s:
        d = Diary(family_id=fid, date=date.today(), status="published",
                  title="小明的一天",
                  body_json=[
                      {"id": "p1", "text": "小明去了三里屯。",
                       "source_clip_ids": [], "hidden": False},
                      {"id": "p2", "text": "和朋友吃了麻辣火锅。",
                       "source_clip_ids": [], "hidden": False},
                  ], cover_images_json=[])
        s.add(d); s.flush()
        return d.id


class FakeIntent:
    def __init__(self, label): self.label = label
    def generate(self, _): return self.label


class FakeQA:
    def __init__(self, answer): self.answer = answer
    def generate(self, _): return self.answer


def test_ask_question_writes_qa_log_and_returns_answer(client, demo_family, engine, monkeypatch):
    _, senior, fam = demo_family
    did = _seed_published(engine, fam.id)

    from app.routers import interactions as ir
    monkeypatch.setattr(ir, "get_intent_client", lambda: FakeIntent("question"))
    monkeypatch.setattr(ir, "get_qa_client", lambda: FakeQA("和朋友一起。"))

    r = client.post(f"/diary/{did}/ask",
                    json={"question": "他和谁一起？", "author_id": senior.id})
    assert r.status_code == 200
    body = r.json()
    assert body["intent"] == "question"
    assert body["answer"] == "和朋友一起。"

    with session_scope(engine) as s:
        assert s.query(QaLog).count() == 1
        assert s.query(Comment).count() == 0


def test_ask_comment_creates_comment(client, demo_family, engine, monkeypatch):
    _, senior, fam = demo_family
    did = _seed_published(engine, fam.id)

    from app.routers import interactions as ir
    monkeypatch.setattr(ir, "get_intent_client", lambda: FakeIntent("comment"))
    monkeypatch.setattr(ir, "get_qa_client", lambda: FakeQA("n/a"))

    r = client.post(f"/diary/{did}/ask",
                    json={"question": "告诉他我想他了", "author_id": senior.id})
    assert r.status_code == 200
    body = r.json()
    assert body["intent"] == "comment"
    assert body["comment_id"] is not None

    with session_scope(engine) as s:
        c = s.query(Comment).first()
        assert c.content == "告诉他我想他了"
        assert c.author_id == senior.id
```

- [ ] **Step 2: 实现 /ask**

Append to `backend/app/routers/interactions.py`:

```python
from pydantic import BaseModel
from app.config import get_settings
from app.models import QaLog
from app.schemas import AskIn, AskOut
from app.services.intent_classifier import classify_intent
from app.services.qa import answer_question


def get_intent_client():
    from app.services.diary_generator import AnthropicDiaryClient
    return AnthropicDiaryClient(api_key=get_settings().anthropic_api_key)


def get_qa_client():
    from app.services.diary_generator import AnthropicDiaryClient
    return AnthropicDiaryClient(api_key=get_settings().anthropic_api_key)


@router.post("/{diary_id}/ask", response_model=AskOut)
def ask(diary_id: int, payload: AskIn, request: Request):
    engine = _engine_from_request(request)
    with session_scope(engine) as s:
        d = s.get(Diary, diary_id)
        if not d:
            raise HTTPException(404, "diary not found")

        intent = classify_intent(payload.question, get_intent_client())

        if intent == "question":
            diary_dict = {
                "title": d.title,
                "paragraphs": [p for p in (d.body_json or []) if not p.get("hidden")],
            }
            answer = answer_question(payload.question, diary_dict, get_qa_client())
            s.add(QaLog(diary_id=diary_id, question=payload.question, answer=answer))
            s.flush()
            return AskOut(intent="question", answer=answer)
        else:
            c = Comment(diary_id=diary_id, author_id=payload.author_id,
                        content=payload.question)
            s.add(c); s.flush()
            return AskOut(intent="comment", comment_id=c.id)
```

- [ ] **Step 3: 运行测试验证通过**

Run: `pytest tests/test_interactions_ask.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add app/routers/interactions.py tests/test_interactions_ask.py
git commit -m "feat(backend): POST /diary/:id/ask routes by intent (qa_logs or comment)"
```

---

## Task 22: CORS + 最终 wire-up

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_cors.py`

- [ ] **Step 1: 写失败的 CORS 测试**

Create `backend/tests/test_cors.py`:

```python
def test_cors_allows_frontend_origin(client):
    r = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
```

- [ ] **Step 2: 改 main.py 加 CORS + 完整路由挂载**

Replace `backend/app/main.py` entirely:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import engine_for_url
from app.models import Base
from app.routers import ingest, clips, diary, interactions

app = FastAPI(title="AI 家庭日记 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    if not hasattr(app.state, "test_engine"):
        engine = engine_for_url("sqlite:///./data/app.db")
        Base.metadata.create_all(engine)
        app.state.engine = engine


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(ingest.router)
app.include_router(clips.router)
app.include_router(diary.router)
app.include_router(interactions.router)
```

- [ ] **Step 3: 运行所有测试确认无回归**

Run: `pytest -v`
Expected: 全部 pass（约 30+ 测试）

- [ ] **Step 4: Commit**

```bash
git add app/main.py tests/test_cors.py
git commit -m "feat(backend): enable CORS for frontend dev server + final router mounting"
```

---

## Task 23: seed 脚本 + 端到端集成测试 + run book

**Files:**
- Create: `backend/app/seed.py`
- Create: `backend/tests/test_integration.py`
- Create: `backend/RUNBOOK.md`

- [ ] **Step 1: 写 seed 脚本（非测试，是给演示用的）**

Create `backend/app/seed.py`:

```python
"""一次性初始化：建表 + 插入一对 demo 家庭 + 少量 mock 社媒素材。

用法：python -m app.seed
"""
from datetime import datetime

from app.db import engine_for_url, session_scope
from app.models import Base, User, Family, RawClip


def main(db_url: str = "sqlite:///./data/app.db"):
    engine = engine_for_url(db_url)
    Base.metadata.create_all(engine)

    with session_scope(engine) as s:
        if s.query(User).count() > 0:
            print("已有数据，跳过 seed")
            return

        junior = User(role="junior", name="小明")
        senior = User(role="senior", name="妈妈")
        s.add_all([junior, senior]); s.flush()
        fam = Family(junior_user_id=junior.id, senior_user_id=senior.id)
        s.add(fam); s.flush()
        junior.family_id = fam.id
        senior.family_id = fam.id

        # 少量 mock 社媒帖作为 "今天" 的种子素材
        today = datetime.utcnow().replace(hour=20, minute=0, second=0, microsecond=0)
        s.add(RawClip(source="social", file_path="",
                      captured_at=today.replace(hour=12),
                      auto_caption="今天在三里屯吃了超辣的麻辣火锅，直冒汗！"))
        s.add(RawClip(source="social", file_path="",
                      captured_at=today.replace(hour=18),
                      auto_caption="和 @小王 @小李 聚了聚，太久没见了"))

    print("seed 完成")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 写端到端集成测试（覆盖 demo 主链路）**

Create `backend/tests/test_integration.py`:

```python
"""End-to-end：ingest → generate → edit → publish → elder 阅读 → 提问 → 留言 → junior 看留言"""
from datetime import date, datetime
from app.models import Comment, QaLog
from app.db import session_scope


class FakeDiaryClient:
    """只用于日记生成"""
    def generate(self, prompt):
        return (
            '{"title":"小明的一天",'
            '"paragraphs":['
            '{"id":"p1","text":"小明中午去了三里屯。","source_clip_ids":[1]},'
            '{"id":"p2","text":"和朋友吃了火锅。","source_clip_ids":[2]}'
            '],"cover_clip_ids":[1,2]}'
        )


class FakeIntentClient:
    """根据问句关键词判断；包含 '？' 或常见问询词 → question，否则 comment"""
    def generate(self, prompt):
        if "？" in prompt or "?" in prompt or "几点" in prompt or "什么" in prompt or "谁" in prompt:
            return "question"
        return "comment"


class FakeQAClient:
    """对所有提问统一返回一个固定温暖的答案"""
    def generate(self, prompt):
        return "和两个朋友一起。"


def test_full_demo_flow(client, demo_family, engine, monkeypatch):
    junior, senior, fam = demo_family

    from app.routers import diary as diary_router
    from app.routers import interactions as interactions_router
    monkeypatch.setattr(diary_router, "get_diary_client", lambda: FakeDiaryClient())
    monkeypatch.setattr(interactions_router, "get_intent_client", lambda: FakeIntentClient())
    monkeypatch.setattr(interactions_router, "get_qa_client", lambda: FakeQAClient())

    # 1. ingest camera clip (带 caption 跳过 vision)
    r = client.post("/ingest/clip", json={
        "source": "camera", "file_path": "/v1.mp4",
        "captured_at": datetime.combine(date.today(), datetime.min.time())
                         .replace(hour=12).isoformat(),
        "auto_caption": "小明走在三里屯",
    })
    assert r.status_code == 201

    # 2. ingest social
    r = client.post("/ingest/social", json={
        "content": "和朋友吃火锅",
        "captured_at": datetime.combine(date.today(), datetime.min.time())
                         .replace(hour=13).isoformat(),
    })
    assert r.status_code == 201

    # 3. generate diary
    r = client.post("/diary/generate", json={"date": date.today().isoformat()})
    assert r.status_code == 201
    diary_id = r.json()["id"]

    # 4. junior GET /today sees draft
    r = client.get("/diary/today?role=junior")
    assert r.status_code == 200
    assert r.json()["status"] == "draft"
    assert r.json()["comments"] == []

    # 5. junior hides p2
    paragraphs = r.json()["paragraphs"]
    paragraphs[1]["hidden"] = True
    client.patch(f"/diary/{diary_id}", json={"paragraphs": paragraphs})

    # 6. publish
    r = client.post(f"/diary/{diary_id}/publish")
    assert r.status_code == 200

    # 7. senior reads (hidden paragraphs filtered)
    r = client.get("/diary/today?role=senior")
    assert r.status_code == 200
    assert len(r.json()["paragraphs"]) == 1
    assert r.json()["paragraphs"][0]["id"] == "p1"

    # 8. senior asks a question
    r = client.post(f"/diary/{diary_id}/ask",
                    json={"question": "他和谁一起吃饭？", "author_id": senior.id})
    assert r.status_code == 200
    assert r.json()["intent"] == "question"
    assert r.json()["answer"] == "和两个朋友一起。"

    # 9. senior leaves a comment
    r = client.post(f"/diary/{diary_id}/ask",
                    json={"question": "告诉他妈妈想他了", "author_id": senior.id})
    assert r.status_code == 200
    assert r.json()["intent"] == "comment"

    # 10. junior 重新拉 today，应该看到妈妈的留言（情感闭环）
    r = client.get("/diary/today?role=junior")
    assert r.status_code == 200
    comments = r.json()["comments"]
    assert len(comments) == 1
    assert comments[0]["content"] == "告诉他妈妈想他了"

    with session_scope(engine) as s:
        assert s.query(QaLog).count() == 1
        assert s.query(Comment).count() == 1
```

- [ ] **Step 3: 运行集成测试**

Run: `pytest tests/test_integration.py -v`
Expected: 1 passed

- [ ] **Step 4: 写 RUNBOOK**

Create `backend/RUNBOOK.md`:

```markdown
# AI 家庭日记后端 · Run Book

## 首次启动

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows bash; macOS/Linux 用 source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env          # 填入 ANTHROPIC_API_KEY
python -m app.seed            # 建表 + 插入 demo 家庭 + mock 素材
```

## 启动 API 服务（开发）

```bash
uvicorn app.main:app --reload --port 8000
```

访问 http://localhost:8000/docs 看 OpenAPI。

## 跑测试

```bash
pytest -v
```

## Demo 演示顺序（对应 Demo 故事线 2:00–3:30 部分的数据准备）

1. 硬件队员已 `POST /ingest/clip` 上传当天素材
2. 演示员 `POST /diary/generate` 触发日记生成
3. 演示员在小辈端调 `PATCH /diary/{id}` 删掉某段
4. `POST /diary/{id}/publish`
5. 长辈端调 `GET /diary/today?role=senior` 拉日记
6. 长辈按"按住说话" → 前端调 `POST /diary/{id}/ask` → 按 intent 分流

## 调试

- 素材入库后是否可见：`GET /clips?date=YYYY-MM-DD`
- 日记是否已发布：`GET /diary/today?role=senior`（未发布返 404）
- 留言是否写入：直接查 SQLite：`sqlite3 data/app.db "SELECT * FROM comments;"`

## 风险 fallback

- Anthropic API 失败：前端友好提示；日记生成失败时用 `{"title":"今天没素材"}` 兜底
- 数据库锁死：删 `data/app.db` 重新 `python -m app.seed`
```

- [ ] **Step 5: 全量回归 + commit**

Run: `pytest -v`
Expected: 全部通过（~35 个测试）

```bash
git add app/seed.py tests/test_integration.py RUNBOOK.md
git commit -m "feat(backend): add seed script, end-to-end integration test, and run book"
```

---

## 完成标志

- [ ] 所有 23 个 Task 的 commit 都已推上
- [ ] `pytest -v` 全绿
- [ ] `uvicorn app.main:app --reload` 能起；`GET /health` 返 `{"status":"ok"}`
- [ ] `python -m app.seed` 能落一对 demo 家庭和几条种子素材
- [ ] 手动打通一次完整链路（见 RUNBOOK "Demo 演示顺序"）

---

## Spec 覆盖自检

| Spec 章节 | 对应 Task | 备注 |
|---|---|---|
| §2.1 角色与关系（junior/senior/family） | Task 4, Task 6 | users + family 表 |
| §2.2 AI 日记 · 每日定时生成 + 3 分钟审核 | Task 13, 15, 16 | 定时任务由前端/外部触发 `POST /diary/generate`；倒计时在前端做 |
| §2.2 长辈端 TTS + 按住说话 | —— | 不在后端范围；前端直调浏览器/云 API |
| §3 五层架构（数据源→摄取→Agent→双端） | Task 7, 8, 9b, 12, 13, 14, 18, 21 | 后端覆盖②③④三层 |
| §4 两端屏幕 | —— | 前端独立项目，不在本计划 |
| §5 数据模型 6 张表 | Task 4 | 完整 |
| §6.1 API 一览 10 个端点 | Task 9, 9b, 10, 11, 13, 14, 15, 16, 17, 18, 21 | 完整 |
| §6.2 ① POST /ingest/clip 无 caption 触发 vision | Task 9, **Task 9b** | Task 9b 接通 FFmpeg + vision 分支 |
| §6.2 ② POST /ingest/social | Task 10 | |
| §6.2 ③ GET /clips（过滤 hidden） | Task 11 | |
| §6.3 ④ POST /diary/generate（跳过 hidden） | Task 13 | |
| §6.3 ⑤ GET /diary/today?role= | Task 14 | junior 含 comments、senior 过滤 hidden 段并空 comments |
| §6.3 ⑥ PATCH /diary/:id（已发布返 409） | Task 15 | |
| §6.3 ⑦ POST /diary/:id/publish（已发布返 409） | Task 16 | |
| §6.3 ⑧ GET /diary/history | Task 17 | |
| §6.4 ⑨ POST /diary/:id/comment | Task 18 | |
| §6.4 ⑩ POST /diary/:id/ask（intent 分流） | Task 19, 20, 21 | |
| §6.5 长辈留言回到小辈端的情感闭环 | Task 14（junior 拉 comments）+ Task 23 集成测试 step 10 | |
| §7 筛选机制（事前/事后） | Task 11 (visibility filter), Task 13 (generate skips hidden), Task 14 (senior filters hidden) | 完整 |
| §8 技术栈 FastAPI/SQLAlchemy/anthropic SDK | Task 1, 3, 7, 8, 12 | 完整 |
| §10 风险 · LLM 失败兜底 | Task 12 (空素材 fallback), Task 9b (vision 失败用兜底字符串), RUNBOOK | |
| §11 YAGNI（不做注册/多家庭/OAuth） | —— | 全程没写这些 |

