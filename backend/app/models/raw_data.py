from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, TIMESTAMP

from app.models.base import Base


class RawData(Base):
    __tablename__ = "raw_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(String(50), unique=True, nullable=False)
    type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    description = Column(Text)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.now, nullable=False)
