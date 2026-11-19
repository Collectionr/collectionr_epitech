from typing import Protocol

from tcg_service.domain.entities.health import DependencyHealth


class HealthIndicatorPort(Protocol):
    """Checks one dependency of the service. Implementations must never raise."""

    def check(self) -> DependencyHealth: ...
