from datetime import datetime
from app.services.diary_generator import generate_diary, DiaryLLMClient


class FakeDiaryClient:
    def __init__(self, response):
        self.response = response
        self.last_prompt = None

    def generate(self, prompt: str) -> str:
        self.last_prompt = prompt
        return self.response


def _clips():
    return [
        {"id": 1, "source": "camera", "auto_caption": "小明走在三里屯",
         "captured_at": datetime(2026, 5, 2, 12, 0)},
        {"id": 2, "source": "camera", "auto_caption": "小明和两个朋友吃火锅",
         "captured_at": datetime(2026, 5, 2, 13, 0)},
        {"id": 3, "source": "social", "auto_caption": "太辣了！",
         "captured_at": datetime(2026, 5, 2, 13, 30)},
    ]


def test_generate_diary_returns_parsed_structure():
    fake_resp = """{
      "title": "小明的一天",
      "paragraphs": [
        {"id": "p1", "text": "今天小明去了三里屯。", "source_clip_ids": [1]},
        {"id": "p2", "text": "和朋友吃了麻辣火锅。", "source_clip_ids": [2, 3]}
      ],
      "cover_clip_ids": [1, 2]
    }"""
    client = FakeDiaryClient(fake_resp)

    diary = generate_diary(_clips(), client)

    assert diary["title"] == "小明的一天"
    assert len(diary["paragraphs"]) == 2
    assert diary["paragraphs"][0]["id"] == "p1"
    assert diary["cover_clip_ids"] == [1, 2]


def test_generate_diary_includes_captions_in_prompt():
    client = FakeDiaryClient('{"title":"t","paragraphs":[],"cover_clip_ids":[]}')
    generate_diary(_clips(), client)
    assert "小明走在三里屯" in client.last_prompt
    assert "小明和两个朋友吃火锅" in client.last_prompt


def test_generate_diary_raises_on_invalid_json():
    client = FakeDiaryClient("not json at all")
    import pytest
    with pytest.raises(ValueError, match="diary JSON"):
        generate_diary(_clips(), client)
