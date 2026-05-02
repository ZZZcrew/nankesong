"""Mock 数据生成脚本。

运行：cd backend && python -m scripts.mock_data

生成两天的数据：今天 7 条，昨天 5 条。
"""
from datetime import datetime, timedelta

from app.models import Base, RawData
from app.models.base import SessionLocal, engine

TODAY_ITEMS = [
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

YESTERDAY_ITEMS = [
    {
        "item_id": "raw_101",
        "type": "image",
        "content": "https://picsum.photos/seed/cycling/800/600",
        "description": "周末骑行，社畜也要有自己的生活",
    },
    {
        "item_id": "raw_102",
        "type": "text",
        "content": "项目终于上线了，绝绝子",
        "description": None,
    },
    {
        "item_id": "raw_103",
        "type": "image",
        "content": "https://picsum.photos/seed/pasta/800/600",
        "description": "学做了意大利面，第一次还挺成功",
    },
    {
        "item_id": "raw_104",
        "type": "text",
        "content": "deadline 前夜 emo 中",
        "description": None,
    },
    {
        "item_id": "raw_105",
        "type": "image",
        "content": "https://picsum.photos/seed/sunset/800/600",
        "description": "下班路上的晚霞，今天没那么累",
    },
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        deleted = db.query(RawData).delete()
        now = datetime.now()
        yesterday = now - timedelta(days=1)

        for item in TODAY_ITEMS:
            db.add(RawData(
                item_id=item["item_id"],
                type=item["type"],
                content=item["content"],
                description=item["description"],
                status="pending",
                created_at=now,
            ))
        for item in YESTERDAY_ITEMS:
            db.add(RawData(
                item_id=item["item_id"],
                type=item["type"],
                content=item["content"],
                description=item["description"],
                status="pending",
                created_at=yesterday,
            ))
        db.commit()
        total = len(TODAY_ITEMS) + len(YESTERDAY_ITEMS)
        print("数据库表创建成功")
        print(f"清理旧数据 {deleted} 条")
        print(f"已生成 {total} 条 Mock 数据（今天 {len(TODAY_ITEMS)} 条 + 昨天 {len(YESTERDAY_ITEMS)} 条）")
    finally:
        db.close()


if __name__ == "__main__":
    main()
