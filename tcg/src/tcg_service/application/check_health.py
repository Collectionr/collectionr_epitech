from collections.abc import Sequence
from datetime import UTC, datetime

from tcg_service.domain.entities.health import HealthStatus
from tcg_service.domain.ports.health_indicator import HealthIndicatorPort

SERVICE_NAME = "tcg"


class CheckHealthUseCase:
    def __init__(
        self, indicators: Sequence[HealthIndicatorPort], environment: str
    ) -> None:
        self._indicators = tuple(indicators)
        self._environment = environment

    def execute(self) -> HealthStatus:
        return HealthStatus(
            service=SERVICE_NAME,
            environment=self._environment,
            checked_at=datetime.now(UTC),
            dependencies=tuple(indicator.check() for indicator in self._indicators),
        )
