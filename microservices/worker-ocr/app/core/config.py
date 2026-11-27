from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REDIS_URL_SCHEMES = ("redis://", "rediss://")


class Settings(BaseSettings):
    """Worker configuration, read from the environment then from `.env`."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Same values as the backend's LOG_LEVEL (pino): one setting can serve both.
    log_level: Literal["fatal", "error", "warn", "info", "debug", "trace"] = "info"

    # Redis OCR: job queue, job statuses and results. The URL may hold a password.
    redis_url: SecretStr
    redis_connect_timeout: float = Field(default=5.0, gt=0, le=60)  # seconds

    # Inference engine loaded at startup; only the fake engine exists for now.
    ocr_model: Literal["stub"] = "stub"
    ocr_stub_delay: float = Field(default=0.0, ge=0, le=60)  # seconds

    # One blocking read of the queue: an idle worker notices a shutdown within it.
    ocr_queue_block_timeout: int = Field(default=5, ge=1, le=60)  # seconds
    ocr_result_ttl: int = Field(default=3600, ge=60, le=86400)  # seconds
    ocr_job_max_attempts: int = Field(default=3, ge=1, le=10)

    @field_validator("redis_url")
    @classmethod
    def _check_redis_scheme(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith(REDIS_URL_SCHEMES):
            raise ValueError("REDIS_URL must start with redis:// or rediss://")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
