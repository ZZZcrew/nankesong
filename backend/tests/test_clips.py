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
