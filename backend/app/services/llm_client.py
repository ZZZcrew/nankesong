import json
from typing import Protocol

from openai import OpenAI


class LLMResponseError(Exception):
    """LLM 返回的不是合法 JSON，或调用失败。"""


class LLMClient(Protocol):
    def complete_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.7,
    ) -> dict: ...


class OpenAICompatibleClient:
    def __init__(self, api_key: str, model: str, base_url: str | None = None):
        kwargs: dict = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = OpenAI(**kwargs)
        self._model = model

    def complete_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.7,
    ) -> dict:
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
                response_format={"type": "json_object"},
            )
        except Exception as e:
            raise LLMResponseError(f"LLM 调用失败: {e}") from e

        content = response.choices[0].message.content or ""
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise LLMResponseError(f"LLM 返回非 JSON: {content[:200]}") from e
