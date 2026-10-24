import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg_pool import PoolTimeout

from tcg_service.config import Settings
from tcg_service.database import Database
from tcg_service.main import create_app
from tests.conftest import FakeDatabase


def test_health_returns_200_when_database_is_up(settings: Settings) -> None:
    database = FakeDatabase()
    with TestClient(create_app(settings, database)) as client:  # type: ignore[arg-type]
        response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "tcg"
    assert body["environment"] == "dev"
    assert body["checks"] == {"api": "up", "database": "up"}
    assert set(body) == {"status", "service", "environment", "timestamp", "checks"}
    assert database.ping_calls == 1


@pytest.mark.parametrize(
    "error",
    [
        psycopg.OperationalError("connection refused"),
        PoolTimeout("couldn't get a connection after 3.00 sec"),
        RuntimeError("unexpected"),
    ],
)
def test_health_returns_503_when_database_is_down(
    settings: Settings, error: Exception
) -> None:
    with TestClient(create_app(settings, FakeDatabase(error))) as client:  # type: ignore[arg-type]
        response = client.get("/health")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["checks"] == {"api": "up", "database": "down"}


def test_health_never_leaks_credentials(settings: Settings) -> None:
    error = psycopg.OperationalError(
        'connection to server at "db.invalid" failed: password "s3cr3t-pwd" rejected'
    )
    with TestClient(create_app(settings, FakeDatabase(error))) as client:  # type: ignore[arg-type]
        response = client.get("/health")

    for secret in ("s3cr3t-pwd", "tcg_user", "db.invalid", "rejected"):
        assert secret not in response.text


def test_lifespan_opens_and_closes_database(settings: Settings) -> None:
    database = FakeDatabase()
    with TestClient(create_app(settings, database)):  # type: ignore[arg-type]
        assert database.opened
        assert not database.closed
    assert database.closed


def test_health_returns_503_with_unreachable_postgres() -> None:
    # Pool réel vers un port fermé : valide la gestion d'erreur sans base réelle.
    unreachable = Settings(
        _env_file=None,
        database_url="postgresql://u:p@127.0.0.1:1/db",
        health_check_timeout=0.5,
        database_connect_timeout=1,
    )
    with TestClient(create_app(unreachable, Database(unreachable))) as client:
        response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["checks"]["database"] == "down"


def test_docs_are_disabled_in_staging() -> None:
    staging = Settings(
        _env_file=None, app_env="staging", database_url="postgresql://u:p@h/db"
    )
    with TestClient(create_app(staging, FakeDatabase())) as client:  # type: ignore[arg-type]
        assert client.get("/docs").status_code == 404
        assert client.get("/health").json()["environment"] == "staging"
