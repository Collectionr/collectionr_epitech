from datetime import UTC, datetime

from tcg_service.domain.entities.health import DependencyHealth, HealthStatus


def build(*dependencies: DependencyHealth) -> HealthStatus:
    return HealthStatus(
        checked_at=datetime(2026, 1, 1, tzinfo=UTC), dependencies=dependencies
    )


def test_status_is_ok_when_every_dependency_is_up() -> None:
    health = build(
        DependencyHealth("database", "up", 3), DependencyHealth("cache", "up", 1)
    )

    assert health.status == "ok"


def test_status_is_degraded_as_soon_as_one_dependency_is_down() -> None:
    health = build(
        DependencyHealth("database", "up", 3), DependencyHealth("cache", "down", None)
    )

    assert health.status == "degraded"
