from psycopg_pool import ConnectionPool

from tcg_service.config import Settings


class Database:
    """Pool de connexions psycopg 3 vers la base PostgreSQL partagée."""

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
        # wait=False : le service démarre même si PostgreSQL est indisponible.
        self._pool.open(wait=False)

    def close(self) -> None:
        self._pool.close()

    def ping(self) -> None:
        """Exécute `SELECT 1` ; lève une exception si la base est injoignable."""
        with self._pool.connection(timeout=self._acquire_timeout) as connection:
            row = connection.execute("SELECT 1").fetchone()
        if row != (1,):
            raise RuntimeError("Réponse inattendue de PostgreSQL")
