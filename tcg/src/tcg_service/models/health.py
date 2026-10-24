from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class HealthChecks(BaseModel):
    api: Literal["up"]
    database: Literal["up", "down"]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    service: str
    environment: str
    timestamp: datetime
    checks: HealthChecks
