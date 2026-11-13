import logging
import threading
import time
from datetime import UTC, datetime

from pydantic import JsonValue, ValidationError
from redis.exceptions import RedisError

from app.inference.engine import InferenceEngine, InferenceError
from app.jobs.models import Job, JobError, JobErrorCode, JobResult, JobStatus
from app.jobs.queue import JobQueue
from app.jobs.store import JobStore

logger = logging.getLogger(__name__)

# Pause before trying again when Redis does not answer.
REDIS_RETRY_DELAY_SECONDS = 2.0

_INTERNAL_ERROR_MESSAGE = "Unexpected error during inference"
_MAX_ATTEMPTS_MESSAGE = "Job abandoned: the worker stopped too many times on it"


class JobConsumer:
    """Takes the jobs one by one from the queue and runs the inference on each.

    Status of a job: pending (set by the producer) -> processing -> done | error.
    A failing job never stops the worker; a Redis outage is waited out.
    """

    def __init__(
        self,
        queue: JobQueue,
        store: JobStore,
        engine: InferenceEngine,
        *,
        block_timeout: int,
        max_attempts: int,
    ) -> None:
        self._queue = queue
        self._store = store
        self._engine = engine
        self._block_timeout = block_timeout
        self._max_attempts = max_attempts
        self._stop_requested = threading.Event()

    def stop(self) -> None:
        """Asks the loop to end once the current job is over."""
        self._stop_requested.set()

    def run(self) -> None:
        logger.info("Worker started", extra={"engine": self._engine.name})
        # Jobs left in the processing list are only ours to take back when no job is
        # running: at startup, and after a Redis outage that interrupted one.
        recovery_needed = True
        while not self._stop_requested.is_set():
            try:
                if recovery_needed:
                    self._requeue_interrupted_jobs()
                    recovery_needed = False
                message = self._queue.claim(self._block_timeout)
                if message is not None:
                    self._handle(message)
            except RedisError as error:
                logger.warning(
                    "Redis unavailable, retrying",
                    extra={"error_type": type(error).__name__},
                )
                recovery_needed = True
                self._stop_requested.wait(REDIS_RETRY_DELAY_SECONDS)
        logger.info("Worker stopped")

    def _requeue_interrupted_jobs(self) -> None:
        count = self._queue.requeue_interrupted()
        if count > 0:
            logger.warning(
                "Interrupted jobs put back in the queue", extra={"jobs": count}
            )

    def _handle(self, message: str) -> None:
        try:
            job = Job.model_validate_json(message)
        except ValidationError:
            # No usable job_id: there is no status to update, the message is dropped.
            logger.error(
                "Invalid job message dropped", extra={"message_size": len(message)}
            )
            self._queue.ack(message)
            return

        attempt = self._store.register_attempt(job.job_id)
        if attempt > self._max_attempts:
            result = self._abandon(job)
        else:
            self._store.set_status(job.job_id, JobStatus.PROCESSING)
            logger.info("Job started", extra={"job_id": job.job_id, "attempt": attempt})
            result = self._execute(job)

        self._store.save_result(result)
        self._queue.ack(message)
        logger.info(
            "Job finished",
            extra={
                "job_id": job.job_id,
                "status": result.status.value,
                "duration_ms": result.duration_ms,
                "error_code": result.error.code.value if result.error else None,
            },
        )

    def _execute(self, job: Job) -> JobResult:
        started_at = datetime.now(UTC)
        start = time.perf_counter()
        data: dict[str, JsonValue] | None = None
        error: JobError | None = None
        try:
            data = self._engine.predict(job.image_path)
        except InferenceError as inference_error:
            error = JobError(
                code=JobErrorCode.INFERENCE_FAILED, message=str(inference_error)
            )
        except Exception:
            # Any model or library failure: the job fails, the worker carries on.
            logger.exception(
                "Unexpected error during inference", extra={"job_id": job.job_id}
            )
            error = JobError(
                code=JobErrorCode.INTERNAL_ERROR, message=_INTERNAL_ERROR_MESSAGE
            )
        duration_ms = round((time.perf_counter() - start) * 1000)
        return JobResult(
            job_id=job.job_id,
            status=JobStatus.ERROR if error else JobStatus.DONE,
            data=data,
            error=error,
            started_at=started_at,
            finished_at=datetime.now(UTC),
            duration_ms=duration_ms,
        )

    def _abandon(self, job: Job) -> JobResult:
        """A job that keeps interrupting the worker is failed instead of retried."""
        now = datetime.now(UTC)
        logger.error(
            "Job abandoned after too many attempts",
            extra={"job_id": job.job_id, "max_attempts": self._max_attempts},
        )
        return JobResult(
            job_id=job.job_id,
            status=JobStatus.ERROR,
            error=JobError(
                code=JobErrorCode.MAX_ATTEMPTS_EXCEEDED, message=_MAX_ATTEMPTS_MESSAGE
            ),
            started_at=now,
            finished_at=now,
            duration_ms=0,
        )
