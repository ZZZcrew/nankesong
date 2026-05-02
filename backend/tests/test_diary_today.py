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
