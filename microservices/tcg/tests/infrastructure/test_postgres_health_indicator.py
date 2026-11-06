import logging
from collections.abc import Iterator

import psycopg
import pytest

from tcg_service.infrastructure.persistence.postgres_health_indicator import (
    PostgresHealthIndicator,
)
from tests.conftest import FakeDatabase


def fake_clock(*readings: float) -> Iterator[float]:
    return iter(readings)


def test_database_is_up_with_its_latency_when_ping_succeeds() -> None:
    clock = fake_clock(10.0, 10.0124)

    health = PostgresHealthIndicator(FakeDatabase(), monotonic=clock.__next__).check()

    assert (health.name, health.state, health.latency_ms) == ("database", "up", 12)


def test_database_is_down_without_latency_when_ping_fails() -> None:
    database = FakeDatabase(psycopg.OperationalError("connection refused"))

    health = PostgresHealthIndicator(database).check()

    assert (health.name, health.state, health.latency_ms) == ("database", "down", None)


def test_only_the_exception_type_is_logged(caplog: pytest.LogCaptureFixture) -> None:
    error = psycopg.OperationalError(
        'connection to "db.invalid" failed: password "s3cr3t"'
    )

    with caplog.at_level(logging.WARNING):
        PostgresHealthIndicator(FakeDatabase(error)).check()

    assert "OperationalError" in caplog.text
    assert "db.invalid" not in caplog.text
    assert "s3cr3t" not in caplog.text
