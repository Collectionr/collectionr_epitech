import pytest
from pydantic import ValidationError

from app.core.config import Settings
from tests.conftest import REDIS_URL, build_settings


def test_defaults() -> None:
    settings = build_settings()
    assert settings.log_level == "info"
    assert settings.redis_connect_timeout == 5.0
    assert settings.ocr_model == "stub"
    assert settings.ocr_stub_delay == 0.0
    assert settings.ocr_queue_block_timeout == 5
    assert settings.ocr_result_ttl == 3600
    assert settings.ocr_job_max_attempts == 3


def test_reads_environment_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REDIS_URL", "rediss://redis-ocr:6379/1")
    monkeypatch.setenv("OCR_RESULT_TTL", "120")
    monkeypatch.setenv("OCR_STUB_DELAY", "1.5")
    settings = Settings(_env_file=None)
    assert settings.redis_url.get_secret_value() == "rediss://redis-ocr:6379/1"
    assert settings.ocr_result_ttl == 120
    assert settings.ocr_stub_delay == 1.5


@pytest.mark.parametrize("level", ["fatal", "error", "warn", "info", "debug", "trace"])
def test_log_level_accepts_the_backend_values(level: str) -> None:
    assert build_settings(log_level=level).log_level == level


def test_redis_url_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("REDIS_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


@pytest.mark.parametrize(
    "overrides",
    [
        {"log_level": "warning"},
        {"redis_url": "http://localhost:6379"},
        {"redis_connect_timeout": 0},
        {"ocr_model": "unknown"},
        {"ocr_stub_delay": -1},
        {"ocr_queue_block_timeout": 0},
        {"ocr_result_ttl": 0},
        {"ocr_job_max_attempts": 0},
    ],
)
def test_invalid_values_are_rejected(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        build_settings(**overrides)


def test_redis_url_is_masked() -> None:
    settings = build_settings()
    assert "secret" in REDIS_URL
    assert "secret" not in repr(settings)
    assert "secret" not in str(settings)
