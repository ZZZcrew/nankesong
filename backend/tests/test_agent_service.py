import pytest

from app.services.agent import (
    AgentOutputError,
    FamLinkAgent,
    SLANG_MAP,
)
from tests.fake_llm import FakeLLMClient


@pytest.fixture
def agent(fake_llm):
    return FamLinkAgent(llm=fake_llm)


def test_preprocess_replaces_slang_in_text_content(agent):
    items = [{"type": "text", "content": "今天emo了想躺平", "description": None}]
    result = agent._preprocess_raw_data(items)
    assert "emo" not in result[0]["processed_text"]
    assert "躺平" not in result[0]["processed_text"]
    assert "心情有点低落" in result[0]["processed_text"]
    assert "休息放松" in result[0]["processed_text"]


def test_preprocess_replaces_slang_in_image_description(agent):
    items = [{
        "type": "image",
        "content": "https://x/a.jpg",
        "description": "周末骑行绝绝子",
    }]
    result = agent._preprocess_raw_data(items)
    assert result[0]["content"] == "https://x/a.jpg"
    assert "绝绝子" not in result[0]["processed_text"]
    assert "很棒" in result[0]["processed_text"]


def test_format_items_prefixes_by_type(agent):
    processed = [
        {"type": "text", "content": "x", "description": None, "processed_text": "摔了"},
        {"type": "image", "content": "u", "description": "d", "processed_text": "火锅"},
        {"type": "video", "content": "v", "description": "d", "processed_text": "骑行"},
    ]
    out = agent._format_items(processed)
    assert "文字动态: 摔了" in out
    assert "图片配文: 火锅" in out
    assert "视频配文: 骑行" in out


def test_generate_diary_cover_from_raw_items_skip_text(agent, fake_llm):
    raw_items = [
        {"type": "text", "content": "摔成狗了", "description": None},
        {"type": "image", "content": "https://x/1.jpg", "description": "火锅"},
        {"type": "video", "content": "https://x/v.mp4", "description": "骑行"},
        {"type": "image", "content": "https://x/2.jpg", "description": "爬山"},
        {"type": "image", "content": "https://x/3.jpg", "description": "晚餐"},
    ]
    result = agent.generate_diary(raw_items, "2026-05-02")
    assert result["cover_image"] == [
        "https://x/1.jpg",
        "https://x/v.mp4",
        "https://x/2.jpg",
    ]


def test_generate_diary_raises_on_missing_field(fake_llm):
    fake_llm.responses["diary"] = {"title": "x"}
    agent = FamLinkAgent(llm=fake_llm)
    with pytest.raises(AgentOutputError):
        agent.generate_diary(
            [{"type": "text", "content": "x", "description": None}],
            "2026-05-02",
        )
