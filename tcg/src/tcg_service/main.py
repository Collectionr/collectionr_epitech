import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from tcg_service.config import Environment, Settings, get_settings
from tcg_service.database import Database
from tcg_service.routers import health
from tcg_service.services.health import HealthService


def create_app(
    settings: Settings | None = None, database: Database | None = None
) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level.upper())
    database = database or Database(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        database.open()
        try:
            yield
        finally:
            database.close()

    # Service interne : documentation interactive réservée à l'environnement dev.
    docs_enabled = settings.app_env is Environment.DEV
    app = FastAPI(
        title="Collectionr — Microservice TCG",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )
    app.state.health_service = HealthService(database, settings.app_env.value)
    app.include_router(health.router)
    return app


def app_factory() -> FastAPI:
    return create_app()
