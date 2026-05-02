from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


def engine_for_url(url: str) -> Engine:
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    kwargs = {"connect_args": connect_args, "future": True}
    if url == "sqlite:///:memory:" or url == "sqlite://":
        kwargs["poolclass"] = StaticPool
    return create_engine(url, **kwargs)


@contextmanager
def session_scope(engine: Engine) -> Iterator[Session]:
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db_dependency(engine: Engine):
    """FastAPI dependency factory; use in routers via Depends."""
    def _dep() -> Iterator[Session]:
        with session_scope(engine) as session:
            yield session
    return _dep
