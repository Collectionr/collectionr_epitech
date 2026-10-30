import logging

import psycopg
import pytest

from tcg_service.infrastructure.persistence.postgres_health_indicator import (
    PostgresHealthIndicator,
)
from tests.conftest import FakeDatabase


def test_database_is_up_when_ping_succeeds() -> None:
    health = PostgresHealthIndicator(FakeDatabase()).check()

    assert (health.name, health.state) == ("database", "up")


def test_database_is_down_when_ping_fails() -> None:
    database = FakeDatabase(psycopg.OperationalError("connection refused"))

    health = PostgresHealthIndicator(database).check()

    assert (health.name, health.state) == ("database", "down")


def test_only_the_exception_type_is_logged(caplog: pytest.LogCaptureFixture) -> None:
    error = psycopg.OperationalError(
        'connection to "db.invalid" failed: password "s3cr3t"'
    )

    with caplog.at_level(logging.WARNING):
        PostgresHealthIndicator(FakeDatabase(error)).check()

    assert "OperationalError" in caplog.text
    assert "db.invalid" not in caplog.text
    assert "s3cr3t" not in caplog.text
