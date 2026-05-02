from fastapi import FastAPI

app = FastAPI(title="AI 家庭日记 API")


@app.get("/health")
def health():
    return {"status": "ok"}
