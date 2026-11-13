from datetime import UTC

from tcg_service.application.check_health import CheckHealthUseCase
from tcg_service.domain.entities.health import DependencyHealth


class StubIndicator:
    def __init__(self, health: DependencyHealth) -> None:
        self._health = health

    def check(self) -> DependencyHealth:
        return self._health


def test_execute_aggregates_every_indicator() -> None:
    use_case = CheckHealthUseCase(
        [
            StubIndicator(DependencyHealth("database", "up", 4)),
            StubIndicator(DependencyHealth("cache", "down", None)),
        ]
    )

    health = use_case.execute()

    assert health.checked_at.tzinfo is UTC
    assert [d.name for d in health.dependencies] == ["database", "cache"]
    assert health.status == "degraded"
