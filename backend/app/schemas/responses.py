from typing import Generic, Literal, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = 200
    message: str = "success"
    data: T | None = None


class RawItem(BaseModel):
    item_id: str
    type: Literal["image", "video", "text"]
    content: str
    description: str | None = None
    timestamp: str


class RawListData(BaseModel):
    date: str
    items: list[RawItem]


class DeleteResultData(BaseModel):
    deleted_count: int


class DiaryData(BaseModel):
    summary_id: str
    title: str
    content: str
    cover_image: list[str]
    suggested_questions: list[str]


class ChatReplyData(BaseModel):
    reply_text: str
    action: Literal["reply", "notify_younger"]
    transfer_content: str | None = None


class MessageItem(BaseModel):
    summary_id: str
    transfer_content: str
    created_at: str


class MessageListData(BaseModel):
    messages: list[MessageItem]
