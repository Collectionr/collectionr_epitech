import pytest
from fastapi import FastAPI

from tcg_service.config import get_settings
from tcg_service.main import app_factory


def test_app_factory_builds_the_app_from_the_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    get_settings.cache_clear()
    try:
        app = app_factory()
    finally:
        get_settings.cache_clear()

    assert isinstance(app, FastAPI)
    assert "/health" in app.openapi()["paths"]
