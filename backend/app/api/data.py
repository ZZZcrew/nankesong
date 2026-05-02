from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import RawData
from app.schemas.requests import DeleteRequest
from app.schemas.responses import (
    ApiResponse,
    DeleteResultData,
    RawItem,
    RawListData,
)

router = APIRouter()


@router.get("/raw", response_model=ApiResponse[RawListData])
def get_raw(
    date: str = Query(..., description="YYYY-MM-DD"),
    user_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    try:
        start = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={
                "code": 400,
                "message": "日期格式错误，应为 YYYY-MM-DD",
                "data": None,
            },
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

    items = [
        RawItem(
            item_id=r.item_id,
            type=r.type,
            content=r.content,
            description=r.description,
            timestamp=str(int(r.created_at.timestamp())),
        )
        for r in rows
    ]
    return ApiResponse[RawListData](
        code=200,
        message="success",
        data=RawListData(date=date, items=items),
    )


@router.post("/raw/delete", response_model=ApiResponse[DeleteResultData])
def delete_raw(req: DeleteRequest, db: Session = Depends(get_db)):
    if not req.item_ids:
        return ApiResponse[DeleteResultData](
            code=200,
            message="成功删除 0 条数据",
            data=DeleteResultData(deleted_count=0),
        )

    hits = (
        db.query(RawData)
        .filter(RawData.item_id.in_(req.item_ids), RawData.status == "pending")
        .all()
    )
    for h in hits:
        h.status = "deleted"
    db.commit()
    count = len(hits)
    return ApiResponse[DeleteResultData](
        code=200,
        message=f"成功删除 {count} 条数据",
        data=DeleteResultData(deleted_count=count),
    )
