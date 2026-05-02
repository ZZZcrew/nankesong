from datetime import date
from app.models import Diary
from app.db import session_scope


def _seed_draft(engine, family_id):
    with session_scope(engine) as s:
        d = Diary(
            family_id=family_id, date=date.today(), status="draft", title="原标题",
            body_json=[
                {"id": "p1", "text": "段一", "source_clip_ids": [1], "hidden": False},
                {"id": "p2", "text": "段二", "source_clip_ids": [2], "hidden": False},
            ],
            cover_images_json=[],
        )
        s.add(d); s.flush()
        return d.id


def test_patch_hides_paragraph(client, demo_family, engine):
    _, _, fam = demo_family
    diary_id = _seed_draft(engine, fam.id)

    payload = {
        "paragraphs": [
            {"id": "p1", "text": "段一", "source_clip_ids": [1], "hidden": False},
            {"id": "p2", "text": "段二", "source_clip_ids": [2], "hidden": True},
        ]
    }
    r = client.patch(f"/diary/{diary_id}", json=payload)
    assert r.status_code == 200
    paragraphs = r.json()["paragraphs"]
    assert paragraphs[1]["hidden"] is True


def test_patch_updates_title(client, demo_family, engine):
    _, _, fam = demo_family
    diary_id = _seed_draft(engine, fam.id)
    r = client.patch(f"/diary/{diary_id}", json={"title": "新标题"})
    assert r.json()["title"] == "新标题"


def test_patch_rejects_published(client, demo_family, engine):
    _, _, fam = demo_family
    with session_scope(engine) as s:
        d = Diary(family_id=fam.id, date=date.today(), status="published",
                  title="t", body_json=[], cover_images_json=[])
        s.add(d); s.flush()
        diary_id = d.id

    r = client.patch(f"/diary/{diary_id}", json={"title": "x"})
    assert r.status_code == 409
