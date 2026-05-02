from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import session_scope
from app.models import RawClip
from app.schemas import IngestClipIn, ClipOut, IngestSocialIn

router = APIRouter(prefix="/ingest", tags=["ingest"])


def _engine_from_request(request: Request):
    return request.app.state.test_engine if hasattr(request.app.state, "test_engine") else request.app.state.engine


@router.post("/clip", response_model=ClipOut, status_code=201)
def ingest_clip(payload: IngestClipIn, request: Request):
    engine = _engine_from_request(request)
    with session_scope(engine) as s:
        clip = RawClip(
            source=payload.source,
            file_path=payload.file_path,
            captured_at=payload.captured_at,
            auto_caption=payload.auto_caption,
        )
        s.add(clip)
        s.flush()
        return ClipOut(
            id=clip.id, source=clip.source, file_path=clip.file_path,
            captured_at=clip.captured_at, auto_caption=clip.auto_caption,
            visibility=clip.visibility,
        )
