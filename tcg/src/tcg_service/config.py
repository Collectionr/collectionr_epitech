from enum import StrEnum
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEV = "dev"
    STAGING = "staging"


class Settings(BaseSettings):
    """Service configuration, read from the environment then from `.env`."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: Environment = Environment.DEV
    log_level: Literal["critical", "error", "warning", "info", "debug"] = "info"

    # Same shared database and same variable as the NestJS backend.
    database_url: SecretStr
    database_pool_max: int = Field(default=5, ge=1, le=100)
    database_connect_timeout: int = Field(default=5, ge=1, le=60)  # seconds
    # Business queries (workers' UPSERTs); /health has its own, shorter timeout.
    database_statement_timeout: int = Field(default=30, ge=1, le=600)  # seconds
    health_check_timeout: float = Field(default=3.0, gt=0, le=30)  # seconds

    @field_validator("database_url")
    @classmethod
    def _check_database_scheme(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith(("postgresql://", "postgres://")):
            raise ValueError("DATABASE_URL must start with postgresql://")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
