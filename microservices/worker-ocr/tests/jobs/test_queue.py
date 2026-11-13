import pytest
from redis import Redis

from app.jobs.keys import PENDING_QUEUE_KEY, PROCESSING_QUEUE_KEY
from app.jobs.models import Job
from app.jobs.queue import JobQueue
from app.jobs.replies import as_int, as_text

TIMEOUT = 1


def job(name: str) -> Job:
    return Job(job_id=name, image_path=f"jobs/{name}/input.jpg")


def claim_job(queue: JobQueue) -> Job:
    message = queue.claim(TIMEOUT)
    assert message is not None
    return Job.model_validate_json(message)


def test_jobs_are_claimed_first_in_first_out(redis_client: Redis) -> None:
    queue = JobQueue(redis_client)
    for name in ("first", "second", "third"):
        queue.enqueue(job(name))

    claimed = [claim_job(queue).job_id for _ in range(3)]

    assert claimed == ["first", "second", "third"]


def test_pending_count_follows_the_queue(redis_client: Redis) -> None:
    queue = JobQueue(redis_client)
    assert queue.pending_count() == 0

    queue.enqueue(job("first"))
    queue.enqueue(job("second"))
    assert queue.pending_count() == 2

    queue.claim(TIMEOUT)
    assert queue.pending_count() == 1


def test_claim_returns_none_when_no_job_comes(redis_client: Redis) -> None:
    assert JobQueue(redis_client).claim(TIMEOUT) is None


def test_a_claimed_job_stays_in_redis_until_it_is_acknowledged(
    redis_client: Redis,
) -> None:
    queue = JobQueue(redis_client)
    queue.enqueue(job("first"))

    message = queue.claim(TIMEOUT)
    assert message is not None
    assert redis_client.lrange(PROCESSING_QUEUE_KEY, 0, -1) == [message]

    queue.ack(message)
    assert redis_client.llen(PROCESSING_QUEUE_KEY) == 0
    assert redis_client.llen(PENDING_QUEUE_KEY) == 0


def test_interrupted_jobs_go_back_in_front_of_the_queue_in_order(
    redis_client: Redis,
) -> None:
    queue = JobQueue(redis_client)
    for name in ("first", "second", "third"):
        queue.enqueue(job(name))
    # A previous run took two jobs and died before finishing them.
    queue.claim(TIMEOUT)
    queue.claim(TIMEOUT)

    assert queue.requeue_interrupted() == 2

    assert redis_client.llen(PROCESSING_QUEUE_KEY) == 0
    assert [claim_job(queue).job_id for _ in range(3)] == ["first", "second", "third"]


def test_requeue_interrupted_does_nothing_on_a_clean_start(redis_client: Redis) -> None:
    assert JobQueue(redis_client).requeue_interrupted() == 0


def test_replies_of_an_unexpected_type_are_rejected() -> None:
    assert as_text(None) is None
    assert as_text("value") == "value"
    assert as_int(3) == 3
    # A client created without decode_responses returns bytes.
    with pytest.raises(TypeError):
        as_text(b"value")
    with pytest.raises(TypeError):
        as_int("3")
