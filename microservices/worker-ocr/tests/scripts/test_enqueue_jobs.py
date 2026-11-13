import time

import pytest
from redis import Redis
from redis.exceptions import ConnectionError as RedisConnectionError

from app.jobs.models import JobStatus
from app.jobs.store import JobStore
from scripts import enqueue_jobs
from tests.conftest import ScriptedEngine, build_consumer, build_settings

Output = pytest.CaptureFixture[str]


@pytest.fixture
def script(monkeypatch: pytest.MonkeyPatch, redis_client: Redis) -> Redis:
    """The script wired to the in-memory Redis, with a worker run at each poll."""
    monkeypatch.setattr(enqueue_jobs, "get_settings", build_settings)
    monkeypatch.setattr(enqueue_jobs, "create_redis_client", lambda _: redis_client)

    def run_worker(_seconds: float) -> None:
        consumer, _, _ = build_consumer(redis_client, ScriptedEngine())
        consumer.run()

    monkeypatch.setattr(time, "sleep", run_worker)
    return redis_client


def test_build_jobs_marks_the_first_ones_as_failing() -> None:
    jobs = enqueue_jobs.build_jobs(count=3, failures=1)

    assert len({job.job_id for job in jobs}) == 3
    assert [job.image_path for job in jobs] == [
        f"jobs/{jobs[0].job_id}/fail.jpg",
        f"jobs/{jobs[1].job_id}/input.jpg",
        f"jobs/{jobs[2].job_id}/input.jpg",
    ]


@pytest.mark.parametrize(
    "argv",
    [["--count", "0"], ["--failures", "-1"], ["--count", "2", "--failures", "3"]],
)
def test_inconsistent_arguments_are_rejected(argv: list[str]) -> None:
    with pytest.raises(SystemExit):
        enqueue_jobs.parse_arguments(argv)


def test_jobs_are_pushed_followed_and_reported(script: Redis, capsys: Output) -> None:
    exit_code = enqueue_jobs.main(["--count", "3", "--failures", "1"])

    output = capsys.readouterr().out
    assert exit_code == enqueue_jobs.EXIT_OK
    assert output.count("queued") == 3
    assert "3 job(s) waiting in the queue" in output
    assert "inference_failed" in output
    assert "expected outcome for every job: yes" in output
    assert "processed in FIFO order:        yes" in output


def test_no_wait_only_pushes_the_jobs(script: Redis, capsys: Output) -> None:
    exit_code = enqueue_jobs.main(["--count", "2", "--no-wait"])

    assert exit_code == enqueue_jobs.EXIT_OK
    assert script.llen("queue:ocr:pending") == 2
    statuses = [script.get(key) for key in script.scan_iter("task:ocr:*:status")]
    assert statuses == [JobStatus.PENDING.value, JobStatus.PENDING.value]
    assert "expected outcome" not in capsys.readouterr().out


def test_jobs_never_processed_are_reported_as_a_failure(
    script: Redis, capsys: Output
) -> None:
    # No time to wait: the worker never gets a chance to run.
    exit_code = enqueue_jobs.main(["--count", "1", "--timeout", "0"])

    output = capsys.readouterr().out
    assert exit_code == enqueue_jobs.EXIT_UNEXPECTED_OUTCOME
    assert "expected outcome for every job: NO" in output


def test_an_unreachable_redis_is_reported_without_its_address(
    script: Redis, monkeypatch: pytest.MonkeyPatch, capsys: Output
) -> None:
    def unreachable(*_: object) -> None:
        raise RedisConnectionError("Error 111 connecting to redis-ocr:6379")

    monkeypatch.setattr(JobStore, "set_status", unreachable)

    exit_code = enqueue_jobs.main(["--count", "1"])

    captured = capsys.readouterr()
    assert exit_code == enqueue_jobs.EXIT_REDIS_UNREACHABLE
    assert "Redis unreachable (ConnectionError)" in captured.err
    assert "redis-ocr" not in captured.err
