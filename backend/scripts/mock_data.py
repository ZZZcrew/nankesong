"""Mock 数据生成脚本。

运行：cd backend && python -m scripts.mock_data
"""
from datetime import datetime

from app.models import Base, RawData
from app.models.base import SessionLocal, engine

MOCK_ITEMS = [
    {
        "item_id": "raw_001",
        "type": "image",
        "content": "https://picsum.photos/seed/hotpot/800/600",
        "description": "今天被 leader 骂了，怒吃一顿火锅",
    },
    {
        "item_id": "raw_002",
        "type": "text",
        "content": "摔成狗了",
        "description": None,
    },
    {
        "item_id": "raw_003",
        "type": "video",
        "content": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
        "description": "周末骑行30公里，绝绝子",
    },
    {
        "item_id": "raw_004",
        "type": "image",
        "content": "https://picsum.photos/seed/coffee/800/600",
        "description": "下午摸鱼喝了杯拿铁",
    },
    {
        "item_id": "raw_005",
        "type": "text",
        "content": "今天emo了，想躺平",
        "description": None,
    },
    {
        "item_id": "raw_006",
        "type": "image",
        "content": "https://picsum.photos/seed/mountain/800/600",
        "description": "周末爬山，风景太美了",
    },
    {
        "item_id": "raw_007",
        "type": "image",
        "content": "https://picsum.photos/seed/dinner/800/600",
        "description": "今天自己做了一顿晚餐",
    },
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        deleted = db.query(RawData).delete()
        now = datetime.now()
        for item in MOCK_ITEMS:
            db.add(RawData(
                item_id=item["item_id"],
                type=item["type"],
                content=item["content"],
                description=item["description"],
                status="pending",
                created_at=now,
            ))
        db.commit()
        print(f"数据库表创建成功")
        print(f"清理旧数据 {deleted} 条")
        print(f"已生成 {len(MOCK_ITEMS)} 条 Mock 数据")
    finally:
        db.close()


if __name__ == "__main__":
    main()
