import logging
import time
from collections.abc import Callable

from tcg_service.domain.entities.health import DATABASE_DEPENDENCY, DependencyHealth
from tcg_service.infrastructure.persistence.database import DatabaseProtocol

logger = logging.getLogger(__name__)


class PostgresHealthIndicator:
    def __init__(
        self,
        database: DatabaseProtocol,
        monotonic: Callable[[], float] = time.perf_counter,
    ) -> None:
        self._database = database
        self._monotonic = monotonic

    def check(self) -> DependencyHealth:
        started_at = self._monotonic()
        try:
            self._database.ping()
        except Exception as exc:
            # Any failure means the dependency is down. Only the exception type is
            # logged: the libpq message may contain the user or the host.
            logger.warning("PostgreSQL health check failed: %s", type(exc).__name__)
            return DependencyHealth(DATABASE_DEPENDENCY, "down", None)
        latency_ms = round((self._monotonic() - started_at) * 1000)
        return DependencyHealth(DATABASE_DEPENDENCY, "up", latency_ms)
