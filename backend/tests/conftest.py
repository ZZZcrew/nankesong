import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import engine_for_url
from app.main import app
from app.models import Base, User, Family


@pytest.fixture
def engine():
    eng = engine_for_url("sqlite:///:memory:")
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def db_session(engine):
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
        session.commit()
    finally:
        session.close()


@pytest.fixture
def demo_family(db_session):
    junior = User(role="junior", name="小明")
    senior = User(role="senior", name="妈妈")
    db_session.add_all([junior, senior])
    db_session.flush()
    family = Family(junior_user_id=junior.id, senior_user_id=senior.id)
    db_session.add(family)
    db_session.flush()
    junior.family_id = family.id
    senior.family_id = family.id
    db_session.flush()
    return junior, senior, family


@pytest.fixture
def client(engine):
    app.state.test_engine = engine
    with TestClient(app) as c:
        yield c
    if hasattr(app.state, "test_engine"):
        delattr(app.state, "test_engine")
