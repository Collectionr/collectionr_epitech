"""Health aggregate of the service and its dependencies (no framework import)."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

DependencyState = Literal["up", "down"]
HealthState = Literal["ok", "degraded"]

DATABASE_DEPENDENCY = "database"


@dataclass(frozen=True, slots=True)
class DependencyHealth:
    name: str
    state: DependencyState


@dataclass(frozen=True, slots=True)
class HealthStatus:
    service: str
    environment: str
    checked_at: datetime
    dependencies: tuple[DependencyHealth, ...]

    @property
    def status(self) -> HealthState:
        """`ok` when every dependency is up, `degraded` as soon as one is down."""
        if all(dependency.state == "up" for dependency in self.dependencies):
            return "ok"
        return "degraded"
