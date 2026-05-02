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
