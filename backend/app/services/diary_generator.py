import json
from typing import Protocol


class DiaryLLMClient(Protocol):
    def generate(self, prompt: str) -> str: ...


class AnthropicDiaryClient:
    """Real adapter around anthropic SDK."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def generate(self, prompt: str) -> str:
        resp = self._client.messages.create(
            model=self._model,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text


FEW_SHOT_EXAMPLES = """
示例 1（目标语感）：
{
  "title": "小雨的周六",
  "paragraphs": [
    {"id": "p1", "text": "小雨今天难得睡了懒觉，中午才起。", "source_clip_ids": [1]},
    {"id": "p2", "text": "下午去朝阳公园走了走，阳光很好。", "source_clip_ids": [2, 3]}
  ],
  "cover_clip_ids": [2, 3]
}
""".strip()


SYSTEM_INSTRUCTION = """
你是一位温暖的家人，每天把一个年轻人的 Insta360 视频描述和社媒动态，
合成一篇给 TA 爸妈看的中文日记。

规则：
- 第三人称，叙事平实，不要夸张修辞。
- 2-5 段，每段一个清晰场景，每段 40-80 字。
- 不要推测情绪或杜撰细节，只根据素材描述如实写。
- 每段必须附 source_clip_ids，表明由哪些素材合成。
- cover_clip_ids 挑 3-5 个视觉最具代表性的。
- 严格输出 JSON，不要任何前后文。

只输出 JSON：
{
  "title": "...",
  "paragraphs": [{"id":"p1","text":"...","source_clip_ids":[...]}],
  "cover_clip_ids":[...]
}
"""


def _build_prompt(clips: list[dict]) -> str:
    captions_block = "\n".join(
        f"- clip_id={c['id']} [{c['source']}] {c['captured_at'].isoformat()}: {c['auto_caption']}"
        for c in clips
    )
    return (
        SYSTEM_INSTRUCTION
        + "\n\n" + FEW_SHOT_EXAMPLES
        + "\n\n今天的素材：\n" + captions_block
        + "\n\n生成 JSON："
    )


def generate_diary(clips: list[dict], client: DiaryLLMClient) -> dict:
    if not clips:
        return {"title": "今天没有素材", "paragraphs": [], "cover_clip_ids": []}

    prompt = _build_prompt(clips)
    raw = client.generate(prompt)

    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"invalid diary JSON: {raw[:200]}")
    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError as e:
        raise ValueError(f"invalid diary JSON: {e}") from e

    return data
