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
