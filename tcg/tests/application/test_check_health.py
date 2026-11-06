from datetime import UTC

from tcg_service.application.check_health import SERVICE_NAME, CheckHealthUseCase
from tcg_service.domain.entities.health import DependencyHealth


class StubIndicator:
    def __init__(self, name: str, state: str) -> None:
        self._health = DependencyHealth(name, state)  # type: ignore[arg-type]

    def check(self) -> DependencyHealth:
        return self._health


def test_execute_aggregates_every_indicator() -> None:
    use_case = CheckHealthUseCase(
        [StubIndicator("database", "up"), StubIndicator("cache", "down")], "staging"
    )

    health = use_case.execute()

    assert health.service == SERVICE_NAME
    assert health.environment == "staging"
    assert health.checked_at.tzinfo is UTC
    assert [d.name for d in health.dependencies] == ["database", "cache"]
    assert health.status == "degraded"
