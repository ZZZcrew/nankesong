import base64
from pathlib import Path
from typing import Protocol


class VisionClient(Protocol):
    def describe(self, image_b64: str, prompt: str) -> str: ...


class AnthropicVisionClient:
    """Real adapter around anthropic SDK."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def describe(self, image_b64: str, prompt: str) -> str:
        resp = self._client.messages.create(
            model=self._model,
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {
                        "type": "base64", "media_type": "image/jpeg", "data": image_b64,
                    }},
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return resp.content[0].text


DEFAULT_PROMPT = (
    "这张照片来自一个年轻人日常生活的 Insta360 相机。"
    "用一句中文描述画面里发生了什么（人、场景、动作）。不要推测情绪。"
)


def caption_image(image_path: str, client: VisionClient, prompt: str = DEFAULT_PROMPT) -> str:
    p = Path(image_path)
    if not p.exists():
        raise FileNotFoundError(image_path)
    b64 = base64.b64encode(p.read_bytes()).decode("ascii")
    return client.describe(b64, prompt)
