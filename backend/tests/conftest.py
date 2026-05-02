from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

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
        poolclass=StaticPool,
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
