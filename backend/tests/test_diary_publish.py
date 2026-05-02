from datetime import date
from app.models import Diary
from app.db import session_scope


def _seed_draft(engine, fid):
    with session_scope(engine) as s:
        d = Diary(family_id=fid, date=date.today(), status="draft",
                  title="t", body_json=[], cover_images_json=[])
        s.add(d); s.flush()
        return d.id


def test_publish_flips_status_and_timestamp(client, demo_family, engine):
    _, _, fam = demo_family
    did = _seed_draft(engine, fam.id)
    r = client.post(f"/diary/{did}/publish")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "published"
    assert body["published_at"] is not None


def test_publish_is_idempotent_on_published(client, demo_family, engine):
    _, _, fam = demo_family
    did = _seed_draft(engine, fam.id)
    client.post(f"/diary/{did}/publish")
    r = client.post(f"/diary/{did}/publish")
    # 409: already published (not idempotent — explicit conflict)
    assert r.status_code == 409
