from collections.abc import Generator

from sqlalchemy.orm import Session

from app.config import settings
from app.models.base import SessionLocal
from app.services.llm_client import LLMClient, OpenAICompatibleClient


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_llm_client() -> LLMClient:
    return OpenAICompatibleClient(
        api_key=settings.OPENAI_API_KEY,
        model=settings.MODEL_NAME,
        base_url=settings.BASE_URL,
    )


def get_agent():
    from app.services.agent import FamLinkAgent
    return FamLinkAgent(llm=get_llm_client())
