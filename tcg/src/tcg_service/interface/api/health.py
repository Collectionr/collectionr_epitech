from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from tcg_service.application.check_health import CheckHealthUseCase
from tcg_service.interface.api.schemas import HealthResponse

router = APIRouter(tags=["health"])


def get_check_health_use_case(request: Request) -> CheckHealthUseCase:
    return request.app.state.check_health_use_case


@router.get(
    "/health",
    response_model=HealthResponse,
    responses={503: {"model": HealthResponse, "description": "PostgreSQL unavailable"}},
)
def health(
    response: Response,
    use_case: Annotated[CheckHealthUseCase, Depends(get_check_health_use_case)],
) -> HealthResponse:
    report = HealthResponse.from_domain(use_case.execute())
    if report.status != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return report
