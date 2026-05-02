from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


class IngestClipIn(BaseModel):
    source: str = Field(pattern="^(camera|social)$")
    file_path: str
    captured_at: datetime
    auto_caption: Optional[str] = None


class IngestSocialIn(BaseModel):
    content: str
    captured_at: datetime
    image_urls: list[str] = Field(default_factory=list)


class ClipOut(BaseModel):
    id: int
    source: str
    file_path: str
    captured_at: datetime
    auto_caption: Optional[str]
    visibility: str


class DiaryParagraph(BaseModel):
    id: str
    text: str
    source_clip_ids: list[int] = Field(default_factory=list)
    hidden: bool = False


class CommentIn(BaseModel):
    author_id: int
    content: str
    audio_url: Optional[str] = None


class CommentOut(BaseModel):
    id: int
    diary_id: int
    author_id: int
    content: str
    audio_url: Optional[str]
    created_at: datetime


class DiaryOut(BaseModel):
    id: int
    date: date
    status: str
    title: str
    paragraphs: list[DiaryParagraph]
    cover_images: list[str]
    published_at: Optional[datetime]
    comments: list[CommentOut] = Field(default_factory=list)


class DiaryPatchIn(BaseModel):
    title: Optional[str] = None
    paragraphs: Optional[list[DiaryParagraph]] = None


class AskIn(BaseModel):
    question: str
    author_id: int


class AskOut(BaseModel):
    intent: str  # "question" | "comment"
    answer: Optional[str] = None
    comment_id: Optional[int] = None
