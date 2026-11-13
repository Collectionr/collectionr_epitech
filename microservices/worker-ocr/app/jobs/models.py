"""Job contract shared by the producer (the API) and the worker."""

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, JsonValue, StringConstraints

# The id is part of Redis key names: restricted to a safe alphabet (a UUID fits).
JobId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")]


class JobStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


class JobErrorCode(StrEnum):
    INFERENCE_FAILED = "inference_failed"
    INTERNAL_ERROR = "internal_error"
    MAX_ATTEMPTS_EXCEEDED = "max_attempts_exceeded"


class Job(BaseModel):
    """Message pushed in the queue by the producer."""

    model_config = ConfigDict(frozen=True, extra="ignore")

    job_id: JobId
    # Path of the image, relative to the shared volume.
    image_path: Annotated[str, StringConstraints(min_length=1, max_length=512)]


class JobError(BaseModel):
    code: JobErrorCode
    # Returned to the client: never an exception message or an internal detail.
    message: str


class JobResult(BaseModel):
    """What the worker stores once a job is over, successfully or not."""

    job_id: JobId
    status: Literal[JobStatus.DONE, JobStatus.ERROR]
    data: dict[str, JsonValue] | None = None
    error: JobError | None = None
    started_at: datetime
    finished_at: datetime
    duration_ms: int
