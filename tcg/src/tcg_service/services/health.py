import logging
from datetime import UTC, datetime

from tcg_service.database import Database
from tcg_service.models.health import HealthChecks, HealthResponse

logger = logging.getLogger(__name__)

SERVICE_NAME = "tcg"


class HealthService:
    def __init__(self, database: Database, environment: str) -> None:
        self._database = database
        self._environment = environment

    def check(self) -> HealthResponse:
        database_up = self._database_is_up()
        return HealthResponse(
            status="ok" if database_up else "degraded",
            service=SERVICE_NAME,
            environment=self._environment,
            timestamp=datetime.now(UTC),
            checks=HealthChecks(api="up", database="up" if database_up else "down"),
        )

    def _database_is_up(self) -> bool:
        try:
            self._database.ping()
        except Exception as exc:  # noqa: BLE001 - toute panne => service dégradé
            # Seul le type est loggué : le message libpq peut contenir utilisateur/hôte.
            logger.warning("Health check PostgreSQL en échec : %s", type(exc).__name__)
            return False
        return True
