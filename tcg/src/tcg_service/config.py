from enum import StrEnum
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEV = "dev"
    STAGING = "staging"


class Settings(BaseSettings):
    """Configuration du service, lue depuis l'environnement puis `.env`."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: Environment = Environment.DEV
    log_level: Literal["critical", "error", "warning", "info", "debug"] = "info"

    # Même base partagée et même variable que le backend NestJS.
    database_url: SecretStr
    database_pool_max: int = Field(default=5, ge=1, le=100)
    database_connect_timeout: int = Field(default=5, ge=1, le=60)  # secondes
    # Requêtes métier (UPSERT des workers) ; /health a son propre délai, plus court.
    database_statement_timeout: int = Field(default=30, ge=1, le=600)  # secondes
    health_check_timeout: float = Field(default=3.0, gt=0, le=30)  # secondes

    @field_validator("database_url")
    @classmethod
    def _check_database_scheme(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith(("postgresql://", "postgres://")):
            raise ValueError("DATABASE_URL doit commencer par postgresql://")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # database_url vient de l'environnement
