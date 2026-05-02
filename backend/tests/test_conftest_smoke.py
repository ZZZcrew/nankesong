from app.models import User, Family


def test_db_session_fixture_works(db_session):
    u = User(role="junior", name="smoke")
    db_session.add(u)
    db_session.flush()
    assert u.id is not None


def test_demo_family_fixture_creates_pair(demo_family, db_session):
    junior, senior, family = demo_family
    assert junior.role == "junior"
    assert senior.role == "senior"
    assert junior.family_id == family.id


def test_client_fixture_health(client):
    r = client.get("/health")
    assert r.status_code == 200
