# FamLink Backend

代际沟通 AI 助手后端。5 个接口、3 张表、Agent 三场景。

## 环境准备

Python 3.11+。

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入 OPENAI_API_KEY
```

## 初始化 Mock 数据

```bash
python -m scripts.mock_data
```

会在 `data/famlink.db` 建表并插入 7 条 Mock 数据。

## 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

访问 <http://localhost:8000/docs> 查看 Swagger UI。

## 接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/v1/data/raw?date=YYYY-MM-DD` | 获取当日待审原始数据 |
| POST | `/api/v1/data/raw/delete` | 批量软删除原始数据 |
| POST | `/api/v1/agent/generate-summary` | 生成长辈友好型日记 |
| POST | `/api/v1/agent/chat` | 长辈对话（可能触发留言传达） |
| GET  | `/api/v1/messages` | 获取留言列表 |
| GET  | `/health` | 健康检查 |

详细请求/响应结构见 `docs/接口文档.md` 或 `/docs` Swagger UI。

## 配置项（.env）

| 变量 | 默认 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | (必填) | OpenAI 或兼容网关的 API Key |
| `BASE_URL` | (空) | OpenAI 兼容网关地址，空则走官方 |
| `MODEL_NAME` | `gpt-4o` | 模型名 |
| `DATABASE_URL` | `sqlite:///./data/famlink.db` | SQLite 路径 |

## 测试

```bash
pytest -v
```

LLM 调用在测试中被 `FakeLLMClient` 替换，不消耗真实 token。
