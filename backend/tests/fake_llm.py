class FakeLLMClient:
    """测试用 LLM 客户端。根据 system prompt 特征词路由到预设响应。"""

    def __init__(self, responses: dict[str, dict]):
        self.responses = responses
        self.calls: list[dict] = []

    def complete_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.7,
    ) -> dict:
        self.calls.append({
            "system": system,
            "user": user,
            "temperature": temperature,
        })

        if "家庭情感翻译官" in system:
            return self.responses["diary"]
        if "陪聊助手" in system:
            if any(kw in user for kw in ["想", "担心", "好久没见", "想念"]):
                return self.responses["chat_notify"]
            return self.responses["chat_reply"]
        if "留言翻译助手" in system:
            return self.responses["transfer"]

        raise ValueError(f"FakeLLMClient: 未匹配 scenario, system={system[:80]}")
