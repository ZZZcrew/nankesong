from datetime import datetime, date
from app.schemas import (
    IngestClipIn, IngestSocialIn, ClipOut,
    DiaryOut, DiaryParagraph, DiaryPatchIn,
    CommentIn, CommentOut, AskIn, AskOut,
)


def test_ingest_clip_in_parses():
    data = IngestClipIn(
        source="camera",
        file_path="/tmp/v.mp4",
        captured_at=datetime(2026, 5, 2, 14, 0),
    )
    assert data.source == "camera"


def test_ingest_social_in_parses():
    data = IngestSocialIn(
        content="今天好累",
        captured_at=datetime(2026, 5, 2, 20, 0),
    )
    assert data.content == "今天好累"


def test_diary_paragraph_defaults_hidden_false():
    p = DiaryParagraph(id="p1", text="今天...", source_clip_ids=[1])
    assert p.hidden is False


def test_diary_patch_in_accepts_partial():
    patch = DiaryPatchIn(
        title="新标题",
        paragraphs=[DiaryParagraph(id="p1", text="改过", source_clip_ids=[], hidden=True)],
    )
    assert patch.title == "新标题"
    assert patch.paragraphs[0].hidden is True


def test_ask_in_requires_text():
    req = AskIn(question="他几点回家？", author_id=1)
    assert req.question == "他几点回家？"
    assert req.author_id == 1


def test_diary_out_comments_default_empty():
    out = DiaryOut(
        id=1, date=date(2026, 5, 2), status="draft", title="t",
        paragraphs=[], cover_images=[], published_at=None,
    )
    assert out.comments == []
