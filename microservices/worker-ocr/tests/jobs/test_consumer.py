import logging

import pytest
from redis import Redis
from redis.exceptions import ConnectionError as RedisConnectionError

from app.jobs import consumer as consumer_module
from app.jobs.keys import PENDING_QUEUE_KEY, PROCESSING_QUEUE_KEY
from app.jobs.models import Job, JobErrorCode, JobResult, JobStatus
from app.jobs.queue import JobQueue
from app.jobs.store import JobStore
from tests.conftest import ScriptedEngine, build_consumer


def submit(queue: JobQueue, store: JobStore, name: str) -> Job:
    """What the producer does: status `pending`, then the job in the queue."""
    job = Job(job_id=name, image_path=f"jobs/{name}/input.jpg")
    store.set_status(job.job_id, JobStatus.PENDING)
    queue.enqueue(job)
    return job


def result_of(store: JobStore, job_id: str) -> JobResult:
    result = store.get_result(job_id)
    assert result is not None
    return result


def test_a_job_goes_from_pending_to_processing_to_done(redis_client: Redis) -> None:
    engine = ScriptedEngine()
    consumer, queue, store = build_consumer(redis_client, engine)
    job = submit(queue, store, "card-1")
    seen_during_inference: list[JobStatus | None] = []
    engine.on_predict = lambda _: seen_during_inference.append(
        store.get_status(job.job_id)
    )
    assert store.get_status(job.job_id) is JobStatus.PENDING

    consumer.run()

    assert seen_during_inference == [JobStatus.PROCESSING]
    assert store.get_status(job.job_id) is JobStatus.DONE
    result = result_of(store, job.job_id)
    assert result.status is JobStatus.DONE
    assert result.data == {"name": "Pikachu"}
    assert result.error is None
    assert result.duration_ms >= 0
    assert result.started_at <= result.finished_at
    assert redis_client.llen(PROCESSING_QUEUE_KEY) == 0


def test_jobs_are_processed_first_in_first_out(redis_client: Redis) -> None:
    engine = ScriptedEngine()
    consumer, queue, store = build_consumer(redis_client, engine)
    for name in ("first", "second", "third"):
        submit(queue, store, name)

    consumer.run()

    assert engine.calls == [
        "jobs/first/input.jpg",
        "jobs/second/input.jpg",
        "jobs/third/input.jpg",
    ]


def test_an_inference_failure_marks_the_job_as_error_and_the_worker_goes_on(
    redis_client: Redis,
) -> None:
    consumer, queue, store = build_consumer(redis_client, ScriptedEngine())
    submit(queue, store, "fail-1")
    submit(queue, store, "card-2")

    consumer.run()

    failed = result_of(store, "fail-1")
    assert store.get_status("fail-1") is JobStatus.ERROR
    assert failed.error is not None
    assert failed.error.code is JobErrorCode.INFERENCE_FAILED
    assert failed.error.message == "Unreadable image"
    assert failed.data is None
    assert store.get_status("card-2") is JobStatus.DONE


def test_an_unexpected_exception_fails_the_job_without_leaking_details(
    redis_client: Redis, caplog: pytest.LogCaptureFixture
) -> None:
    consumer, queue, store = build_consumer(redis_client, ScriptedEngine())
    submit(queue, store, "crash-1")
    submit(queue, store, "card-2")

    with caplog.at_level(logging.ERROR):
        consumer.run()

    crashed = result_of(store, "crash-1")
    assert crashed.error is not None
    assert crashed.error.code is JobErrorCode.INTERNAL_ERROR
    assert "CUDA" not in crashed.error.message
    assert any(record.exc_info for record in caplog.records)
    assert store.get_status("card-2") is JobStatus.DONE


def test_invalid_messages_are_dropped(
    redis_client: Redis, caplog: pytest.LogCaptureFixture
) -> None:
    engine = ScriptedEngine()
    consumer, queue, store = build_consumer(redis_client, engine)
    redis_client.lpush(PENDING_QUEUE_KEY, "not json")
    redis_client.lpush(PENDING_QUEUE_KEY, '{"job_id": "no-image"}')
    redis_client.lpush(PENDING_QUEUE_KEY, '{"job_id": "a:b", "image_path": "x.jpg"}')
    submit(queue, store, "card-1")

    with caplog.at_level(logging.ERROR):
        consumer.run()

    assert engine.calls == ["jobs/card-1/input.jpg"]
    assert store.get_status("card-1") is JobStatus.DONE
    assert redis_client.llen(PROCESSING_QUEUE_KEY) == 0
    dropped = [r for r in caplog.records if r.message == "Invalid job message dropped"]
    assert len(dropped) == 3


def test_jobs_left_unfinished_by_a_previous_run_are_processed_first(
    redis_client: Redis, caplog: pytest.LogCaptureFixture
) -> None:
    engine = ScriptedEngine()
    consumer, queue, store = build_consumer(redis_client, engine)
    submit(queue, store, "first")
    submit(queue, store, "second")
    # A previous run took the first job and died before finishing it.
    JobQueue(redis_client).claim(1)
    store.set_status("first", JobStatus.PROCESSING)

    with caplog.at_level(logging.WARNING):
        consumer.run()

    assert engine.calls == ["jobs/first/input.jpg", "jobs/second/input.jpg"]
    assert store.get_status("first") is JobStatus.DONE
    assert redis_client.llen(PROCESSING_QUEUE_KEY) == 0
    assert "Interrupted jobs put back in the queue" in caplog.messages


def test_a_job_that_keeps_interrupting_the_worker_is_abandoned(
    redis_client: Redis,
) -> None:
    engine = ScriptedEngine()
    consumer, queue, store = build_consumer(redis_client, engine, max_attempts=2)
    submit(queue, store, "poison")
    # The worker already started this job twice without finishing it.
    store.register_attempt("poison")
    store.register_attempt("poison")

    consumer.run()

    assert engine.calls == []
    abandoned = result_of(store, "poison")
    assert store.get_status("poison") is JobStatus.ERROR
    assert abandoned.error is not None
    assert abandoned.error.code is JobErrorCode.MAX_ATTEMPTS_EXCEEDED
    assert redis_client.llen(PROCESSING_QUEUE_KEY) == 0


def test_stop_ends_the_loop_once_the_current_job_is_over(redis_client: Redis) -> None:
    engine = ScriptedEngine()
    consumer, queue, store = build_consumer(redis_client, engine)
    submit(queue, store, "first")
    submit(queue, store, "second")
    engine.on_predict = lambda _: consumer.stop()

    consumer.run()

    assert engine.calls == ["jobs/first/input.jpg"]
    assert store.get_status("first") is JobStatus.DONE
    assert store.get_status("second") is JobStatus.PENDING
    assert queue.pending_count() == 1


def test_a_redis_outage_is_waited_out_and_the_interrupted_job_is_retried(
    redis_client: Redis,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setattr(consumer_module, "REDIS_RETRY_DELAY_SECONDS", 0)
    engine = ScriptedEngine()
    consumer, queue, store = build_consumer(redis_client, engine)
    submit(queue, store, "card-1")
    real_save_result = store.save_result
    outages = [RedisConnectionError("Error 111 connecting to redis-ocr:6379")]

    def save_result_after_one_outage(result: JobResult) -> None:
        if outages:
            raise outages.pop()
        real_save_result(result)

    monkeypatch.setattr(store, "save_result", save_result_after_one_outage)

    with caplog.at_level(logging.WARNING):
        consumer.run()

    assert engine.calls == ["jobs/card-1/input.jpg", "jobs/card-1/input.jpg"]
    assert store.get_status("card-1") is JobStatus.DONE
    assert redis_client.llen(PROCESSING_QUEUE_KEY) == 0
    [warning] = [
        r for r in caplog.records if r.message == "Redis unavailable, retrying"
    ]
    assert warning.__dict__["error_type"] == "ConnectionError"
    assert "redis-ocr" not in caplog.text


def test_each_step_of_a_job_is_logged_with_its_id(
    redis_client: Redis, caplog: pytest.LogCaptureFixture
) -> None:
    consumer, queue, store = build_consumer(redis_client, ScriptedEngine())
    submit(queue, store, "fail-1")

    with caplog.at_level(logging.INFO):
        consumer.run()

    by_message = {record.message: record.__dict__ for record in caplog.records}
    assert by_message["Worker started"]["engine"] == "scripted"
    assert by_message["Job started"]["job_id"] == "fail-1"
    assert by_message["Job started"]["attempt"] == 1
    finished = by_message["Job finished"]
    assert finished["job_id"] == "fail-1"
    assert finished["status"] == "error"
    assert finished["error_code"] == "inference_failed"
    assert isinstance(finished["duration_ms"], int)
    assert "Worker stopped" in by_message
