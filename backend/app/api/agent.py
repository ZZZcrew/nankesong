import json
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.deps import get_agent, get_db
from app.models import Diary, Message, RawData
from app.schemas.requests import ChatRequest, GenerateSummaryRequest
from app.schemas.responses import ApiResponse, ChatReplyData, DiaryData
from app.services.agent import FamLinkAgent

router = APIRouter()


@router.post("/generate-summary", response_model=ApiResponse[DiaryData])
def generate_summary(
    req: GenerateSummaryRequest,
    db: Session = Depends(get_db),
    agent: FamLinkAgent = Depends(get_agent),
):
    try:
        start = datetime.strptime(req.date, "%Y-%m-%d")
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={"code": 400, "message": "日期格式错误", "data": None},
        )
    end = start + timedelta(days=1)

    rows = (
        db.query(RawData)
        .filter(
            RawData.status == "pending",
            RawData.created_at >= start,
            RawData.created_at < end,
        )
        .order_by(RawData.created_at)
        .all()
    )
    if not rows:
        return JSONResponse(
            status_code=400,
            content={
                "code": 400,
                "message": "当日没有可处理的数据",
                "data": None,
            },
        )

    raw_items = [
        {"type": r.type, "content": r.content, "description": r.description}
        for r in rows
    ]
    result = agent.generate_diary(raw_items, req.date)
    summary_id = f"sum_{uuid4().hex[:8]}"

    diary = Diary(
        summary_id=summary_id,
        date=req.date,
        title=result["title"],
        content=result["content"],
        cover_image=json.dumps(result["cover_image"], ensure_ascii=False),
        suggested_questions=json.dumps(result["suggested_questions"], ensure_ascii=False),
        raw_data_ids=json.dumps([r.item_id for r in rows], ensure_ascii=False),
    )
    db.add(diary)
    for r in rows:
        r.status = "processed"
    db.commit()

    return ApiResponse[DiaryData](
        code=200,
        message="Agent 处理完成",
        data=DiaryData(
            summary_id=summary_id,
            title=result["title"],
            content=result["content"],
            cover_image=result["cover_image"],
            suggested_questions=result["suggested_questions"],
        ),
    )


@router.post("/chat", response_model=ApiResponse[ChatReplyData])
def chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    agent: FamLinkAgent = Depends(get_agent),
):
    diary = db.query(Diary).filter_by(summary_id=req.summary_id).first()
    if diary is None:
        return JSONResponse(
            status_code=404,
            content={"code": 404, "message": "日记不存在", "data": None},
        )

    chat_result = agent.chat_with_elder(
        diary_title=diary.title,
        diary_content=diary.content,
        elder_query=req.query,
    )

    if chat_result["action"] == "reply":
        return ApiResponse[ChatReplyData](
            code=200,
            message="success",
            data=ChatReplyData(
                reply_text=chat_result["reply_text"],
                action="reply",
            ),
        )

    transfer_result = agent.transfer_message(
        summary_id=req.summary_id,
        elder_query=req.query,
        agent_reply=chat_result["reply_text"],
    )
    msg = Message(
        summary_id=req.summary_id,
        elder_query=req.query,
        agent_reply=chat_result["reply_text"],
        transfer_content=transfer_result["transfer_content"],
        is_transferred=False,
    )
    db.add(msg)
    db.commit()

    return ApiResponse[ChatReplyData](
        code=200,
        message="success",
        data=ChatReplyData(
            reply_text=chat_result["reply_text"],
            action="notify_younger",
            transfer_content=transfer_result["transfer_content"],
        ),
    )
