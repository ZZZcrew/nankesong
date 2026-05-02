from pydantic import BaseModel


class DeleteRequest(BaseModel):
    item_ids: list[str]
    user_id: str


class GenerateSummaryRequest(BaseModel):
    date: str
    user_id: str


class ChatRequest(BaseModel):
    query: str
    summary_id: str
