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
