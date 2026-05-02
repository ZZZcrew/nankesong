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


def test_ingest_clip_without_caption_calls_vision(client, demo_family, monkeypatch, tmp_path):
    # 用真 OpenCV 抽帧需要真视频；此处把 frame_extractor + vision 都注入 fake
    fake_calls = {"frames": [], "captions": []}

    def fake_extract(video_path, output_dir, every_n_seconds):
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


def test_ingest_clip_vision_failure_stores_sentinel(client, demo_family, monkeypatch):
    """If OpenCV or vision raises, auto_caption falls back to [未生成描述]."""
    def boom_extract(*a, **k):
        raise RuntimeError("camera glitched")

    from app.routers import ingest as ingest_router
    monkeypatch.setattr(ingest_router, "extract_keyframes", boom_extract)
    monkeypatch.setattr(ingest_router, "get_vision_client", lambda: object())

    payload = {
        "source": "camera",
        "file_path": "/tmp/clipX.mp4",
        "captured_at": "2026-05-02T17:00:00",
    }
    r = client.post("/ingest/clip", json=payload)
    assert r.status_code == 201
    assert r.json()["auto_caption"] == "[未生成描述]"


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
