import tempfile
from pathlib import Path

from fastapi import APIRouter, Request

from app.config import get_settings
from app.db import session_scope
from app.models import RawClip
from app.schemas import IngestClipIn, ClipOut, IngestSocialIn
from app.services.frame_extractor import extract_keyframes
from app.services.vision import caption_image, AnthropicVisionClient

router = APIRouter(prefix="/ingest", tags=["ingest"])


def _engine_from_request(request: Request):
    return request.app.state.test_engine if hasattr(request.app.state, "test_engine") else request.app.state.engine


def get_vision_client():
    """Overridable in tests via monkeypatch."""
    return AnthropicVisionClient(api_key=get_settings().anthropic_api_key)


def _tmp_parent_dir() -> str | None:
    """Resolve a parent dir for TemporaryDirectory; None means system default."""
    try:
        settings = get_settings()
        return settings.data_dir if Path(settings.data_dir).exists() else None
    except Exception:
        return None


def _auto_caption_from_video(file_path: str) -> str:
    """抽 1-3 帧，每帧描述一句，拼成一段。失败时返回兜底字符串（让上游决定如何处理）。"""
    try:
        with tempfile.TemporaryDirectory(dir=_tmp_parent_dir()) as tmp:
            frames = extract_keyframes(
                video_path=file_path,
                output_dir=tmp,
                every_n_seconds=2,
            )
            client = get_vision_client()
            captions = [caption_image(f, client) for f in frames[:3]]
        return " ".join(c for c in captions if c).strip()
    except Exception as e:
        # 24h demo 容错：vision 失败不阻塞入库，留给小辈手动补
        return f"[视觉描述失败: {type(e).__name__}]"


@router.post("/clip", response_model=ClipOut, status_code=201)
def ingest_clip(payload: IngestClipIn, request: Request):
    engine = _engine_from_request(request)

    auto_caption = payload.auto_caption
    if not auto_caption and payload.source == "camera":
        auto_caption = _auto_caption_from_video(payload.file_path)

    with session_scope(engine) as s:
        clip = RawClip(
            source=payload.source,
            file_path=payload.file_path,
            captured_at=payload.captured_at,
            auto_caption=auto_caption,
        )
        s.add(clip)
        s.flush()
        return ClipOut(
            id=clip.id, source=clip.source, file_path=clip.file_path,
            captured_at=clip.captured_at, auto_caption=clip.auto_caption,
            visibility=clip.visibility,
        )
