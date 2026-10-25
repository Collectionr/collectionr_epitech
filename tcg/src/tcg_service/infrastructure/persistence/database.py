from typing import Protocol

from psycopg_pool import ConnectionPool

from tcg_service.config import Settings


class DatabaseProtocol(Protocol):
    """Structural type of `Database`, so tests can inject a fake without a real pool."""

    def open(self) -> None: ...

    def close(self) -> None: ...

    def ping(self) -> None: ...


class Database:
    """psycopg 3 connection pool to the shared PostgreSQL database."""

    def __init__(self, settings: Settings) -> None:
        self._acquire_timeout = settings.health_check_timeout
        statement_timeout_ms = int(settings.health_check_timeout * 1000)
        self._pool = ConnectionPool(
            conninfo=settings.database_url.get_secret_value(),
            min_size=1,
            max_size=settings.database_pool_max,
            open=False,
            name="tcg-postgres",
            kwargs={
                "autocommit": True,
                "connect_timeout": settings.database_connect_timeout,
                "options": f"-c statement_timeout={statement_timeout_ms}",
            },
        )

    def open(self) -> None:
        # wait=False: the service starts even when PostgreSQL is unavailable.
        self._pool.open(wait=False)

    def close(self) -> None:
        self._pool.close()

    def ping(self) -> None:
        """Run `SELECT 1`; raises when the database is unreachable."""
        with self._pool.connection(timeout=self._acquire_timeout) as connection:
            row = connection.execute("SELECT 1").fetchone()
        if row != (1,):
            raise RuntimeError("Unexpected response from PostgreSQL")
