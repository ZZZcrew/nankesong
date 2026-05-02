from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import agent, data, messages
from app.config import settings
from app.models import Base, engine

app = FastAPI(
    title="FamLink API",
    description="代际沟通 AI 助手 - 黑客松版",
    version="1.0.0",
)

if settings.DATABASE_URL.startswith("sqlite:///"):
    db_path = Path(settings.DATABASE_URL.removeprefix("sqlite:///"))
    db_path.parent.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=DATA_DIR), name="static")

app.include_router(data.router, prefix="/api/v1/data", tags=["data"])
app.include_router(agent.router, prefix="/api/v1/agent", tags=["agent"])
app.include_router(messages.router, prefix="/api/v1", tags=["messages"])


@app.get("/health")
def health():
    return {"status": "ok"}
