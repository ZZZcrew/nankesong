"""Mock 数据生成脚本。

运行：cd backend && python -m scripts.mock_data

数据主题：南客松 S2 黑客松现场。图片来自 backend/data/20260503/，
通过 FastAPI 的 /static 挂载点对外暴露，URL 与前端硬编码的
后端地址保持一致（http://192.168.188.244:8000）。
"""
from datetime import datetime, timedelta

from app.models import Base, RawData
from app.models.base import SessionLocal, engine

STATIC_BASE_URL = "http://192.168.188.244:8000/static/20260503"

IMG_AUDITORIUM = f"{STATIC_BASE_URL}/1.png"
IMG_OPENING = f"{STATIC_BASE_URL}/2.png"
IMG_TEAM_TABLE = f"{STATIC_BASE_URL}/3.png"
IMG_HACKING = f"{STATIC_BASE_URL}/4.jpg"

TODAY_ITEMS = [
    {
        "item_id": "raw_001",
        "type": "image",
        "content": IMG_AUDITORIUM,
        "description": "上午的分享会，几个团队轮流上台 demo，干货拉满",
    },
    {
        "item_id": "raw_002",
        "type": "text",
        "content": "黑客松第二天，肝到凌晨两点把 demo 雏形写完了",
        "description": None,
    },
    {
        "item_id": "raw_003",
        "type": "image",
        "content": IMG_TEAM_TABLE,
        "description": "我们组围着圆桌肝代码，桌上堆满电脑、瓶子和主办方发的帆布包",
    },
    {
        "item_id": "raw_004",
        "type": "image",
        "content": IMG_HACKING,
        "description": "队友戴着口罩闷头敲键盘，状态拉满",
    },
    {
        "item_id": "raw_005",
        "type": "text",
        "content": "evaluator 还是跑不通，再调一调",
        "description": None,
    },
    {
        "item_id": "raw_006",
        "type": "image",
        "content": IMG_AUDITORIUM,
        "description": "下午又听了一场技术分享，关于 Agent 编排的，挺受启发",
    },
    {
        "item_id": "raw_007",
        "type": "text",
        "content": "晚饭随便扒了两口外卖就接着写，明天就要 final demo 了",
        "description": None,
    },
]

YESTERDAY_ITEMS = [
    {
        "item_id": "raw_101",
        "type": "image",
        "content": IMG_OPENING,
        "description": "南客松 S2 开幕式现场，红色大屏一打，气氛立刻就上来了",
    },
    {
        "item_id": "raw_102",
        "type": "text",
        "content": "组队成功！我们要做一个帮父母和子女沟通的 AI 助手",
        "description": None,
    },
    {
        "item_id": "raw_103",
        "type": "image",
        "content": IMG_TEAM_TABLE,
        "description": "找到工位了，把电脑摆好就开干，桌上的帆布包是入场福利",
    },
    {
        "item_id": "raw_104",
        "type": "text",
        "content": "晚上 brainstorm 到很晚，方向终于敲定：代际沟通 + 多模态输入",
        "description": None,
    },
    {
        "item_id": "raw_105",
        "type": "image",
        "content": IMG_HACKING,
        "description": "队友说先把数据流跑通，今晚先打通最小闭环",
    },
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        deleted = db.query(RawData).delete()
        # 固定为 2026-05-03（与 backend/data/20260503/ 图片日期对齐），
        # 保留当前时间的时分秒，避免同一天多次运行时间戳完全相同。
        current = datetime.now()
        now = current.replace(year=2026, month=5, day=3)
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
