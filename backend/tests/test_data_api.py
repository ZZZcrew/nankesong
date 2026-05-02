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
