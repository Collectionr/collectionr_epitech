import pytest
from pydantic import ValidationError

from tcg_service.config import Environment, Settings

URL = "postgresql://user:secret@localhost:5432/db"


def build(**overrides: object) -> Settings:
    return Settings(_env_file=None, **{"database_url": URL, **overrides})  # type: ignore[arg-type]


def test_defaults() -> None:
    settings = build()
    assert settings.app_env is Environment.DEV
    assert settings.database_pool_max == 5
    assert settings.database_connect_timeout == 5
    assert settings.database_statement_timeout == 30
    assert settings.health_check_timeout == 3.0


def test_reads_environment_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("DATABASE_URL", URL)
    monkeypatch.setenv("DATABASE_POOL_MAX", "10")
    settings = Settings(_env_file=None)
    assert settings.app_env is Environment.STAGING
    assert settings.database_pool_max == 10


def test_database_url_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


@pytest.mark.parametrize(
    "overrides",
    [
        {"app_env": "production"},
        {"database_url": "mysql://u:p@h/db"},
        {"database_pool_max": 0},
        {"database_statement_timeout": 0},
        {"health_check_timeout": 0},
    ],
)
def test_invalid_values_are_rejected(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        build(**overrides)


def test_database_url_is_masked() -> None:
    settings = build()
    assert "secret" not in repr(settings)
    assert "secret" not in str(settings)
