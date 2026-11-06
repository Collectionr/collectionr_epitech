from fastapi import FastAPI

from tcg_service.interface.api.app import create_app


def app_factory() -> FastAPI:
    """Entry point for uvicorn: `uvicorn tcg_service.main:app_factory --factory`."""
    return create_app()
