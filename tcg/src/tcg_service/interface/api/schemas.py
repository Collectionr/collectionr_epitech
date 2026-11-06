from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel

from tcg_service.domain.entities.health import DATABASE_DEPENDENCY, HealthStatus


class HealthChecks(BaseModel):
    api: Literal["up"]
    database: Literal["up", "down"]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    service: str
    environment: str
    timestamp: datetime
    checks: HealthChecks

    @classmethod
    def from_domain(cls, health: HealthStatus) -> Self:
        states = {
            dependency.name: dependency.state for dependency in health.dependencies
        }
        return cls(
            status=health.status,
            service=health.service,
            environment=health.environment,
            timestamp=health.checked_at,
            checks=HealthChecks(api="up", database=states[DATABASE_DEPENDENCY]),
        )
