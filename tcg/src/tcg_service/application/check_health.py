from collections.abc import Sequence
from datetime import UTC, datetime

from tcg_service.domain.entities.health import HealthStatus
from tcg_service.domain.ports.health_indicator import HealthIndicatorPort


class CheckHealthUseCase:
    def __init__(self, indicators: Sequence[HealthIndicatorPort]) -> None:
        self._indicators = tuple(indicators)

    def execute(self) -> HealthStatus:
        return HealthStatus(
            checked_at=datetime.now(UTC),
            dependencies=tuple(indicator.check() for indicator in self._indicators),
        )
