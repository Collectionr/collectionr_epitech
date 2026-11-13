from datetime import UTC, datetime

from redis import Redis

from app.jobs.keys import attempts_key, result_key, status_key
from app.jobs.models import JobError, JobErrorCode, JobResult, JobStatus
from app.jobs.store import JobStore

TTL = 120
JOB_ID = "a3f8c1d2-4e56-7890-abcd-ef1234567890"
NOW = datetime(2026, 11, 13, 10, 0, 0, tzinfo=UTC)


def done_result() -> JobResult:
    return JobResult(
        job_id=JOB_ID,
        status=JobStatus.DONE,
        data={"name": "Pikachu", "confidence": 0.94},
        started_at=NOW,
        finished_at=NOW,
        duration_ms=42,
    )


def test_keys_follow_the_documented_names() -> None:
    assert status_key(JOB_ID) == f"task:ocr:{JOB_ID}:status"
    assert result_key(JOB_ID) == f"result:ocr:{JOB_ID}"


def test_status_round_trip_with_a_limited_lifetime(redis_client: Redis) -> None:
    store = JobStore(redis_client, ttl=TTL)

    store.set_status(JOB_ID, JobStatus.PROCESSING)

    assert store.get_status(JOB_ID) is JobStatus.PROCESSING
    assert redis_client.ttl(status_key(JOB_ID)) == TTL


def test_unknown_job_has_no_status_and_no_result(redis_client: Redis) -> None:
    store = JobStore(redis_client, ttl=TTL)

    assert store.get_status(JOB_ID) is None
    assert store.get_result(JOB_ID) is None


def test_attempts_are_counted_per_job(redis_client: Redis) -> None:
    store = JobStore(redis_client, ttl=TTL)

    assert store.register_attempt(JOB_ID) == 1
    assert store.register_attempt(JOB_ID) == 2
    assert store.register_attempt("another-job") == 1
    assert redis_client.ttl(attempts_key(JOB_ID)) == TTL


def test_saving_a_result_also_sets_the_final_status(redis_client: Redis) -> None:
    store = JobStore(redis_client, ttl=TTL)
    store.set_status(JOB_ID, JobStatus.PROCESSING)
    store.register_attempt(JOB_ID)

    store.save_result(done_result())

    assert store.get_status(JOB_ID) is JobStatus.DONE
    assert store.get_result(JOB_ID) == done_result()
    assert redis_client.ttl(result_key(JOB_ID)) == TTL
    assert redis_client.exists(attempts_key(JOB_ID)) == 0


def test_an_error_result_keeps_its_code_and_message(redis_client: Redis) -> None:
    store = JobStore(redis_client, ttl=TTL)
    result = JobResult(
        job_id=JOB_ID,
        status=JobStatus.ERROR,
        error=JobError(code=JobErrorCode.INFERENCE_FAILED, message="Unreadable image"),
        started_at=NOW,
        finished_at=NOW,
        duration_ms=3,
    )

    store.save_result(result)

    assert store.get_status(JOB_ID) is JobStatus.ERROR
    stored = store.get_result(JOB_ID)
    assert stored is not None
    assert stored.error == result.error
    assert stored.data is None
