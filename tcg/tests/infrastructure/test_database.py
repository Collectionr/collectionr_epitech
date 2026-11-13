from collections.abc import Iterator
from contextlib import contextmanager

import pytest

from tcg_service.config import Settings
from tcg_service.infrastructure.persistence import database as database_module
from tcg_service.infrastructure.persistence.database import Database


class FakeCursor:
    def __init__(self, row: tuple[int, ...]) -> None:
        self._row = row

    def fetchone(self) -> tuple[int, ...]:
        return self._row


class FakeConnection:
    """Records each query and whether it ran inside an explicit transaction."""

    def __init__(self, row: tuple[int, ...]) -> None:
        self.row = row
        self.queries: list[tuple[str, object, bool]] = []
        self._in_transaction = False

    def execute(self, query: str, params: object = None) -> FakeCursor:
        self.queries.append((query, params, self._in_transaction))
        return FakeCursor(self.row)

    @contextmanager
    def transaction(self) -> Iterator[None]:
        self._in_transaction = True
        try:
            yield
        finally:
            self._in_transaction = False


class FakePool:
    """Test double for `psycopg_pool.ConnectionPool`: no real connection."""

    def __init__(self, **kwargs: object) -> None:
        self.kwargs = kwargs
        self.fake_connection = FakeConnection(row=(1,))
        self.acquire_timeouts: list[float | None] = []
        self.opened_with: dict[str, object] | None = None
        self.closed = False

    def open(self, **kwargs: object) -> None:
        self.opened_with = kwargs

    def close(self) -> None:
        self.closed = True

    @contextmanager
    def connection(self, timeout: float | None = None) -> Iterator[FakeConnection]:
        self.acquire_timeouts.append(timeout)
        yield self.fake_connection


@pytest.fixture
def pools(monkeypatch: pytest.MonkeyPatch) -> list[FakePool]:
    created: list[FakePool] = []

    def build_pool(**kwargs: object) -> FakePool:
        pool = FakePool(**kwargs)
        created.append(pool)
        return pool

    monkeypatch.setattr(database_module, "ConnectionPool", build_pool)
    return created


@pytest.fixture
def timeouts_settings(settings: Settings) -> Settings:
    return settings.model_copy(
        update={"database_statement_timeout": 30, "health_check_timeout": 3.0}
    )


def test_pool_applies_the_business_statement_timeout(
    pools: list[FakePool], timeouts_settings: Settings
) -> None:
    Database(timeouts_settings)

    fake_connectionkwargs = pools[0].kwargs["kwargs"]
    assert isinstance(fake_connectionkwargs, dict)
    assert fake_connectionkwargs["options"] == "-c statement_timeout=30000"


def test_ping_limits_only_its_own_transaction_to_the_health_check_timeout(
    pools: list[FakePool], timeouts_settings: Settings
) -> None:
    Database(timeouts_settings).ping()

    pool = pools[0]
    assert pool.acquire_timeouts == [3.0]
    assert pool.fake_connection.queries == [
        ("SELECT set_config('statement_timeout', %s, true)", ("3000",), True),
        ("SELECT 1", None, True),
    ]


def test_ping_raises_on_unexpected_response(
    pools: list[FakePool], settings: Settings
) -> None:
    database = Database(settings)
    pools[0].fake_connection.row = (2,)

    with pytest.raises(RuntimeError):
        database.ping()


def test_open_does_not_wait_for_postgres_and_close_closes_the_pool(
    pools: list[FakePool], settings: Settings
) -> None:
    database = Database(settings)

    database.open()
    database.close()

    assert pools[0].opened_with == {"wait": False}
    assert pools[0].closed
