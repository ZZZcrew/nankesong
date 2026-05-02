from sqlalchemy import text
from app.db import engine_for_url, session_scope


def test_engine_for_url_creates_sqlite_engine():
    engine = engine_for_url("sqlite:///:memory:")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1")).scalar()
        assert result == 1


def test_session_scope_commits_on_success():
    engine = engine_for_url("sqlite:///:memory:")

    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)"))
        conn.commit()

    with session_scope(engine) as session:
        session.execute(text("INSERT INTO t (v) VALUES ('x')"))

    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM t")).scalar()
        assert count == 1


def test_session_scope_rolls_back_on_exception():
    engine = engine_for_url("sqlite:///:memory:")

    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)"))
        conn.commit()

    try:
        with session_scope(engine) as session:
            session.execute(text("INSERT INTO t (v) VALUES ('y')"))
            raise RuntimeError("boom")
    except RuntimeError:
        pass

    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM t")).scalar()
        assert count == 0
