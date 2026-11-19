from datetime import UTC, datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, field_serializer
from pydantic.alias_generators import to_camel

from tcg_service.domain.entities.health import HealthStatus


class CamelCaseModel(BaseModel):
    """JSON keys in camelCase, like the backend API (checkedAt, latencyMs)."""

    model_config = ConfigDict(
        alias_generator=to_camel, validate_by_name=True, serialize_by_alias=True
    )


class DependencyHealthResponse(CamelCaseModel):
    name: str
    status: Literal["up", "down"]
    latency_ms: int | None


class HealthResponse(CamelCaseModel):
    """Same contract as the backend `/health` (HealthResponseDto)."""

    status: Literal["ok", "degraded"]
    checked_at: datetime
    dependencies: list[DependencyHealthResponse]

    @field_serializer("checked_at")
    def _serialize_checked_at(self, value: datetime) -> str:
        # Same format as JavaScript's Date.toISOString(): UTC, milliseconds, "Z".
        utc_value = value.astimezone(UTC).isoformat(timespec="milliseconds")
        return utc_value.replace("+00:00", "Z")

    @classmethod
    def from_domain(cls, health: HealthStatus) -> Self:
        return cls(
            status=health.status,
            checked_at=health.checked_at,
            dependencies=[
                DependencyHealthResponse(
                    name=dependency.name,
                    status=dependency.state,
                    latency_ms=dependency.latency_ms,
                )
                for dependency in health.dependencies
            ],
        )
