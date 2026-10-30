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
        self._health_check_timeout = settings.health_check_timeout
        self._health_check_timeout_ms = int(settings.health_check_timeout * 1000)
        statement_timeout_ms = settings.database_statement_timeout * 1000
        self._pool = ConnectionPool(
            conninfo=settings.database_url.get_secret_value(),
            min_size=1,
            max_size=settings.database_pool_max,
            open=False,
            name="tcg-postgres",
            kwargs={
                "autocommit": True,
                "connect_timeout": settings.database_connect_timeout,
                # Default for every query of the pool, business queries included.
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
        with (
            self._pool.connection(timeout=self._health_check_timeout) as connection,
            connection.transaction(),
        ):
            # is_local=true (SET LOCAL): the health check timeout ends with this
            # transaction, the pooled connection keeps the business timeout.
            connection.execute(
                "SELECT set_config('statement_timeout', %s, true)",
                (str(self._health_check_timeout_ms),),
            )
            row = connection.execute("SELECT 1").fetchone()
        if row != (1,):
            raise RuntimeError("Unexpected response from PostgreSQL")
