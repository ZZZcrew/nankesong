from datetime import datetime

from sqlalchemy import Boolean, Column, Integer, String, Text, TIMESTAMP

from app.models.base import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    summary_id = Column(String(50), nullable=False)
    elder_query = Column(Text, nullable=False)
    agent_reply = Column(Text)
    transfer_content = Column(Text)
    is_transferred = Column(Boolean, default=False, nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.now, nullable=False)
