from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    OPENAI_API_KEY: str = "sk-placeholder"
    BASE_URL: str | None = None
    MODEL_NAME: str = "gpt-4o"
    DATABASE_URL: str = "sqlite:///./data/famlink.db"


settings = Settings()
