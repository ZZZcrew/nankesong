from datetime import date as date_cls, datetime, timedelta
from fastapi import APIRouter, Query, Request

from app.db import session_scope
from app.deps import engine_from_request
from app.models import RawClip
from app.schemas import ClipOut

router = APIRouter(prefix="/clips", tags=["clips"])


@router.get("", response_model=list[ClipOut])
def list_clips(request: Request, date: date_cls = Query(...)):
    engine = engine_from_request(request)
    start = datetime.combine(date, datetime.min.time())
    end = start + timedelta(days=1)
    with session_scope(engine) as s:
        rows = (
            s.query(RawClip)
            .filter(RawClip.captured_at >= start)
            .filter(RawClip.captured_at < end)
            .filter(RawClip.visibility == "visible")
            .order_by(RawClip.captured_at)
            .all()
        )
        return [
            ClipOut(
                id=r.id, source=r.source, file_path=r.file_path,
                captured_at=r.captured_at, auto_caption=r.auto_caption,
                visibility=r.visibility,
            ) for r in rows
        ]
