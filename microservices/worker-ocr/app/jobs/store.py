from redis import Redis

from app.jobs.keys import attempts_key, result_key, status_key
from app.jobs.models import JobResult, JobStatus
from app.jobs.replies import as_int, as_text


class JobStore:
    """Status and result of the jobs, in Redis, with a limited lifetime.

    Redis OCR is not a business store: every key expires after `ttl` seconds.
    """

    def __init__(self, client: Redis, ttl: int) -> None:
        self._client = client
        self._ttl = ttl

    def set_status(self, job_id: str, status: JobStatus) -> None:
        self._client.set(status_key(job_id), status.value, ex=self._ttl)

    def get_status(self, job_id: str) -> JobStatus | None:
        status = as_text(self._client.get(status_key(job_id)))
        return None if status is None else JobStatus(status)

    def register_attempt(self, job_id: str) -> int:
        """Counts one more start of the job and returns the new total."""
        key = attempts_key(job_id)
        with self._client.pipeline(transaction=True) as pipeline:
            pipeline.incr(key)
            pipeline.expire(key, self._ttl)
            attempts, _ = pipeline.execute()
        return as_int(attempts)

    def save_result(self, result: JobResult) -> None:
        """Stores the result and the final status together (one transaction)."""
        with self._client.pipeline(transaction=True) as pipeline:
            pipeline.set(
                result_key(result.job_id), result.model_dump_json(), ex=self._ttl
            )
            pipeline.set(status_key(result.job_id), result.status.value, ex=self._ttl)
            pipeline.delete(attempts_key(result.job_id))
            pipeline.execute()

    def get_result(self, job_id: str) -> JobResult | None:
        result = as_text(self._client.get(result_key(job_id)))
        return None if result is None else JobResult.model_validate_json(result)
