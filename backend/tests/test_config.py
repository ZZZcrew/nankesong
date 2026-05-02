import os
from app.config import Settings


def test_settings_reads_env_vars(monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))

    settings = Settings()

    assert settings.anthropic_api_key == "sk-test-key"
    assert settings.data_dir == str(tmp_path)


def test_settings_has_defaults(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.delenv("DATA_DIR", raising=False)

    settings = Settings()

    assert settings.data_dir == "./data"
