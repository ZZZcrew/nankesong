from datetime import datetime, date
from typing import Optional

from sqlalchemy import String, Integer, ForeignKey, DateTime, Date, JSON, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(16))  # 'junior' | 'senior'
    name: Mapped[str] = mapped_column(String(64))
    family_id: Mapped[Optional[int]] = mapped_column(ForeignKey("family.id"), nullable=True)


class Family(Base):
    __tablename__ = "family"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    junior_user_id: Mapped[int] = mapped_column(Integer)
    senior_user_id: Mapped[int] = mapped_column(Integer)


class RawClip(Base):
    __tablename__ = "raw_clips"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(16))  # 'camera' | 'social'
    file_path: Mapped[str] = mapped_column(String(512))
    captured_at: Mapped[datetime] = mapped_column(DateTime)
    auto_caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    visibility: Mapped[str] = mapped_column(String(16), default="visible")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Diary(Base):
    __tablename__ = "diaries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("family.id"))
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # 'draft' | 'published'
    title: Mapped[str] = mapped_column(String(128))
    body_json: Mapped[list] = mapped_column(JSON, default=list)
    cover_images_json: Mapped[list] = mapped_column(JSON, default=list)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    diary_id: Mapped[int] = mapped_column(ForeignKey("diaries.id"))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text)
    audio_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class QaLog(Base):
    __tablename__ = "qa_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    diary_id: Mapped[int] = mapped_column(ForeignKey("diaries.id"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
