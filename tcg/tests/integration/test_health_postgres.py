"""Tests d'intégration : nécessitent une vraie base PostgreSQL.

Lancés uniquement si TCG_TEST_DATABASE_URL est défini, sinon ignorés.
"""

import os

import pytest
from fastapi.testclient import TestClient

from tcg_service.config import Settings
from tcg_service.database import Database
from tcg_service.main import create_app

DATABASE_URL = os.environ.get("TCG_TEST_DATABASE_URL")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not DATABASE_URL, reason="TCG_TEST_DATABASE_URL non défini"),
]


def test_health_with_real_postgres() -> None:
    settings = Settings(_env_file=None, database_url=DATABASE_URL)  # type: ignore[arg-type]
    with TestClient(create_app(settings, Database(settings))) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["checks"]["database"] == "up"
