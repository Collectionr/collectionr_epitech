from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from tcg_service.models.health import HealthResponse
from tcg_service.services.health import HealthService

router = APIRouter(tags=["health"])


def get_health_service(request: Request) -> HealthService:
    return request.app.state.health_service


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={
        503: {"model": HealthResponse, "description": "PostgreSQL indisponible"}
    },
)
def health(
    response: Response,
    service: Annotated[HealthService, Depends(get_health_service)],
) -> HealthResponse:
    report = service.check()
    if report.status != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return report
