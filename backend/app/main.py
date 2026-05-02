from fastapi import FastAPI

from app.db import engine_for_url
from app.models import Base
from app.routers import ingest as ingest_router, clips as clips_router, diary as diary_router

app = FastAPI(title="AI 家庭日记 API")


@app.on_event("startup")
def _startup():
    if not hasattr(app.state, "test_engine"):
        import os
        os.makedirs("./data", exist_ok=True)
        engine = engine_for_url("sqlite:///./data/app.db")
        Base.metadata.create_all(engine)
        app.state.engine = engine


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(ingest_router.router)
app.include_router(clips_router.router)
app.include_router(diary_router.router)
