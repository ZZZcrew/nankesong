from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, TIMESTAMP

from app.models.base import Base


class Diary(Base):
    __tablename__ = "diaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(String(50), unique=True, nullable=False)
    date = Column(String(10), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    cover_image = Column(Text)
    suggested_questions = Column(Text)
    raw_data_ids = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.now, nullable=False)
