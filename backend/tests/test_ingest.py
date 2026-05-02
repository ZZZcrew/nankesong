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
