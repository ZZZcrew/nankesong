from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Message
from app.schemas.responses import ApiResponse, MessageItem, MessageListData

router = APIRouter()


@router.get("/messages", response_model=ApiResponse[MessageListData])
def get_messages(
    user_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    rows = db.query(Message).order_by(Message.created_at.desc()).all()
    items = [
        MessageItem(
            summary_id=r.summary_id,
            transfer_content=r.transfer_content or "",
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]
    return ApiResponse[MessageListData](
        code=200,
        message="success",
        data=MessageListData(messages=items),
    )
