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
