import logging

from tcg_service.domain.entities.health import DATABASE_DEPENDENCY, DependencyHealth
from tcg_service.infrastructure.persistence.database import DatabaseProtocol

logger = logging.getLogger(__name__)


class PostgresHealthIndicator:
    def __init__(self, database: DatabaseProtocol) -> None:
        self._database = database

    def check(self) -> DependencyHealth:
        try:
            self._database.ping()
        except Exception as exc:
            # Any failure means the dependency is down. Only the exception type is
            # logged: the libpq message may contain the user or the host.
            logger.warning("PostgreSQL health check failed: %s", type(exc).__name__)
            return DependencyHealth(DATABASE_DEPENDENCY, "down")
        return DependencyHealth(DATABASE_DEPENDENCY, "up")
