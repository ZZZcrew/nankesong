import logging

from app.prompts import chat as chat_prompt
from app.prompts import diary as diary_prompt
from app.prompts import transfer as transfer_prompt
from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)


class AgentOutputError(Exception):
    """Agent LLM 返回 JSON 合法但字段缺失/非法。"""


SLANG_MAP = {
    "emo": "心情有点低落",
    "躺平": "休息放松",
    "PUA": "工作遇到挑战",
    "绝绝子": "很棒",
    "社畜": "工作努力",
    "摸鱼": "休息放松",
    "摔成狗了": "有点小意外",
    "leader": "领导",
}


class FamLinkAgent:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    def generate_diary(self, raw_items: list[dict], date: str) -> dict:
        processed = self._preprocess_raw_data(raw_items)
        items_text = self._format_items(processed)
        user = diary_prompt.USER_TEMPLATE.format(date=date, items=items_text)
        result = self.llm.complete_json(
            diary_prompt.SYSTEM, user, temperature=0.7
        )
        for key in ("title", "content", "suggested_questions"):
            if key not in result:
                raise AgentOutputError(f"diary 输出缺字段: {key}")
        if not isinstance(result["suggested_questions"], list):
            raise AgentOutputError("suggested_questions 非列表")

        covers = [
            it["content"]
            for it in raw_items
            if it["type"] in ("image", "video")
        ][:3]

        return {
            "title": result["title"],
            "content": result["content"],
            "cover_image": covers,
            "suggested_questions": result["suggested_questions"],
        }

    def chat_with_elder(
        self,
        diary_title: str,
        diary_content: str,
        elder_query: str,
    ) -> dict:
        user = chat_prompt.USER_TEMPLATE.format(
            diary_title=diary_title,
            diary_content=diary_content,
            elder_query=elder_query,
        )
        result = self.llm.complete_json(
            chat_prompt.SYSTEM, user, temperature=0.8
        )
        if "reply_text" not in result:
            raise AgentOutputError("chat 输出缺 reply_text")
        action = result.get("action", "reply")
        if action not in ("reply", "notify_younger"):
            logger.warning("chat 返回非法 action=%s, 回退为 reply", action)
            action = "reply"
        return {
            "reply_text": result["reply_text"],
            "action": action,
            "emotion_type": result.get("emotion_type", ""),
        }

    def transfer_message(
        self,
        summary_id: str,
        elder_query: str,
        agent_reply: str,
    ) -> dict:
        user = transfer_prompt.USER_TEMPLATE.format(
            elder_query=elder_query,
            agent_reply=agent_reply,
        )
        result = self.llm.complete_json(
            transfer_prompt.SYSTEM, user, temperature=0.7
        )
        if "transfer_content" not in result:
            raise AgentOutputError("transfer 输出缺 transfer_content")
        transfer_content = result["transfer_content"]
        if len(transfer_content) > 40:
            transfer_content = transfer_content[:40]
        return {
            "transfer_content": transfer_content,
            "emotion_type": result.get("emotion_type", ""),
            "suggested_reply": result.get("suggested_reply", ""),
        }

    def _preprocess_raw_data(self, items: list[dict]) -> list[dict]:
        result = []
        for it in items:
            if it["type"] == "text":
                text = it["content"]
            else:
                text = it.get("description") or ""
            for slang, replacement in SLANG_MAP.items():
                text = text.replace(slang, replacement)
            result.append({
                "type": it["type"],
                "content": it["content"],
                "description": it.get("description"),
                "processed_text": text,
            })
        return result

    def _format_items(self, processed: list[dict]) -> str:
        lines = []
        for it in processed:
            text = it["processed_text"] or "（无配文）"
            if it["type"] == "text":
                lines.append(f"文字动态: {text}")
            elif it["type"] == "image":
                lines.append(f"图片配文: {text}")
            elif it["type"] == "video":
                lines.append(f"视频配文: {text}")
        return "\n".join(lines)
