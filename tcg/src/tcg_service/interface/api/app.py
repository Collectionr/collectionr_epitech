from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from tcg_service.application.check_health import CheckHealthUseCase
from tcg_service.config import Environment, Settings, get_settings
from tcg_service.infrastructure.logging.json_logging import configure_logging
from tcg_service.infrastructure.persistence.database import (
    Database,
    DatabaseProtocol,
)
from tcg_service.infrastructure.persistence.postgres_health_indicator import (
    PostgresHealthIndicator,
)
from tcg_service.interface.api import health


def create_app(
    settings: Settings | None = None, database: DatabaseProtocol | None = None
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    database = database or Database(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        database.open()
        try:
            yield
        finally:
            database.close()

    # Internal service: interactive documentation is reserved for the dev environment.
    docs_enabled = settings.app_env is Environment.DEV
    app = FastAPI(
        title="Collectionr — TCG Microservice",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )
    app.state.check_health_use_case = CheckHealthUseCase(
        [PostgresHealthIndicator(database)]
    )
    app.include_router(health.router)
    return app
