from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import Base, engine

app = FastAPI(
    title="FamLink API",
    description="代际沟通 AI 助手 - 黑客松版",
    version="1.0.0",
)

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}
