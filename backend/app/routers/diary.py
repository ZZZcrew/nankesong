from datetime import date as date_cls, datetime, timedelta
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.db import session_scope
from app.deps import engine_from_request
from app.models import Diary, Family, RawClip
from app.schemas import DiaryOut, DiaryParagraph
from app.services.diary_generator import generate_diary, AnthropicDiaryClient

router = APIRouter(prefix="/diary", tags=["diary"])


def get_diary_client():
    """Overridable in tests via monkeypatch."""
    return AnthropicDiaryClient(api_key=get_settings().anthropic_api_key)


class _GeneratedParagraph(BaseModel):
    id: str
    text: str
    source_clip_ids: list[int] = []


class _GeneratedDiary(BaseModel):
    title: str = "今日日记"
    paragraphs: list[_GeneratedParagraph] = []
    cover_clip_ids: list[int] = []


class GenerateIn(BaseModel):
    date: date_cls


def _to_out(d: Diary) -> DiaryOut:
    return DiaryOut(
        id=d.id, date=d.date, status=d.status, title=d.title,
        paragraphs=[DiaryParagraph(**p) for p in (d.body_json or [])],
        cover_images=d.cover_images_json or [],
        published_at=d.published_at,
    )


@router.post("/generate", response_model=DiaryOut, status_code=201)
def generate(payload: GenerateIn, request: Request):
    engine = engine_from_request(request)
    start = datetime.combine(payload.date, datetime.min.time())
    end = start + timedelta(days=1)

    with session_scope(engine) as s:
        fam = s.query(Family).first()
        if not fam:
            raise HTTPException(500, "no family configured")

        clips = (
            s.query(RawClip)
            .filter(RawClip.captured_at >= start)
            .filter(RawClip.captured_at < end)
            .filter(RawClip.visibility == "visible")
            .order_by(RawClip.captured_at)
            .all()
        )
        clip_dicts = [
            {"id": c.id, "source": c.source,
             "auto_caption": c.auto_caption or "", "captured_at": c.captured_at}
            for c in clips
        ]

        llm = get_diary_client()
        generated = generate_diary(clip_dicts, llm)

        try:
            validated = _GeneratedDiary.model_validate(generated)
        except ValidationError as e:
            raise HTTPException(502, f"malformed LLM diary: {e.errors()[:3]}")

        # Resolve cover_clip_ids → file_path
        id_to_path = {c.id: c.file_path for c in clips}
        covers = [id_to_path[i] for i in validated.cover_clip_ids if i in id_to_path]

        paragraphs = [
            {"id": p.id, "text": p.text,
             "source_clip_ids": p.source_clip_ids, "hidden": False}
            for p in validated.paragraphs
        ]

        d = Diary(
            family_id=fam.id,
            date=payload.date,
            status="draft",
            title=validated.title,
            body_json=paragraphs,
            cover_images_json=covers,
        )
        s.add(d)
        s.flush()
        return _to_out(d)
