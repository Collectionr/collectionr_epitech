"""Manual test of the queue, without any API: pushes jobs and follows them.

    python -m scripts.enqueue_jobs --count 5 --failures 1

Plays the producer's part (what the API will do): sets each job to `pending`, pushes
it in the queue, then reads the statuses and the results written by the worker.
Exit code: 0 if every job ended as expected and in FIFO order, 1 otherwise, 2 if
Redis is unreachable.
"""

import argparse
import sys
import time
import uuid
from collections.abc import Sequence

from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.redis_client import create_redis_client
from app.inference.stub_engine import FAILURE_MARKER
from app.jobs.models import Job, JobResult, JobStatus
from app.jobs.queue import JobQueue
from app.jobs.store import JobStore

POLL_INTERVAL_SECONDS = 0.2
DEFAULT_JOB_COUNT = 3
DEFAULT_TIMEOUT_SECONDS = 30.0
TERMINAL_STATUSES = frozenset({JobStatus.DONE, JobStatus.ERROR})

EXIT_OK = 0
EXIT_UNEXPECTED_OUTCOME = 1
EXIT_REDIS_UNREACHABLE = 2


def parse_arguments(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--count", type=int, default=DEFAULT_JOB_COUNT, help="number of jobs to push"
    )
    parser.add_argument(
        "--failures",
        type=int,
        default=0,
        help="how many of them (the first ones) simulate an inference failure",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="seconds to wait for the worker before giving up",
    )
    parser.add_argument(
        "--no-wait", action="store_true", help="push the jobs and exit immediately"
    )
    arguments = parser.parse_args(argv)
    if arguments.count < 1 or not 0 <= arguments.failures <= arguments.count:
        parser.error("--count must be >= 1 and --failures between 0 and --count")
    return arguments


def build_jobs(count: int, failures: int) -> list[Job]:
    jobs = []
    for index in range(count):
        job_id = str(uuid.uuid4())
        file_name = f"{FAILURE_MARKER}.jpg" if index < failures else "input.jpg"
        jobs.append(Job(job_id=job_id, image_path=f"jobs/{job_id}/{file_name}"))
    return jobs


def push(jobs: Sequence[Job], queue: JobQueue, store: JobStore) -> None:
    for number, job in enumerate(jobs, start=1):
        # Status first: the worker may take the job as soon as it is in the queue.
        store.set_status(job.job_id, JobStatus.PENDING)
        queue.enqueue(job)
        print(f"queued      job {number}/{len(jobs)}  {job.job_id}")
    print(f"{queue.pending_count()} job(s) waiting in the queue")


def follow(
    jobs: Sequence[Job], store: JobStore, timeout: float
) -> dict[str, JobStatus | None]:
    """Prints every status change until all jobs are over or the timeout expires."""
    statuses: dict[str, JobStatus | None] = {
        job.job_id: JobStatus.PENDING for job in jobs
    }
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        for number, job in enumerate(jobs, start=1):
            if statuses[job.job_id] in TERMINAL_STATUSES:
                continue
            status = store.get_status(job.job_id)
            if status != statuses[job.job_id]:
                statuses[job.job_id] = status
                label = status.value if status else "expired"
                print(f"{label:<11} job {number}/{len(jobs)}  {job.job_id}")
        if all(status in TERMINAL_STATUSES for status in statuses.values()):
            break
        time.sleep(POLL_INTERVAL_SECONDS)
    return statuses


def report(
    jobs: Sequence[Job],
    statuses: dict[str, JobStatus | None],
    store: JobStore,
    failures: int,
) -> bool:
    """Prints the summary. True if every job ended as expected, in FIFO order."""
    results: list[JobResult] = []
    as_expected = True
    print("\n  #  status      duration  error")
    for index, job in enumerate(jobs):
        status = statuses[job.job_id]
        expected = JobStatus.ERROR if index < failures else JobStatus.DONE
        as_expected = as_expected and status == expected
        result = store.get_result(job.job_id)
        if result is None:
            print(f"{index + 1:>3}  {status or 'expired':<10}  -")
            continue
        results.append(result)
        error = result.error.code.value if result.error else "-"
        print(
            f"{index + 1:>3}  {result.status.value:<10}  "
            f"{result.duration_ms:>5} ms  {error}"
        )

    start_times = [result.started_at for result in results]
    fifo = len(results) == len(jobs) and start_times == sorted(start_times)
    print(f"\nexpected outcome for every job: {'yes' if as_expected else 'NO'}")
    print(f"processed in FIFO order:        {'yes' if fifo else 'NO'}")
    return as_expected and fifo


def main(argv: Sequence[str] | None = None) -> int:
    arguments = parse_arguments(argv)
    settings = get_settings()
    client = create_redis_client(settings)
    queue = JobQueue(client)
    store = JobStore(client, ttl=settings.ocr_result_ttl)
    jobs = build_jobs(arguments.count, arguments.failures)
    try:
        push(jobs, queue, store)
        if arguments.no_wait:
            return EXIT_OK
        statuses = follow(jobs, store, arguments.timeout)
        succeeded = report(jobs, statuses, store, arguments.failures)
    except RedisError as error:
        # The type only: a Redis error message may contain the host of the instance.
        print(f"Redis unreachable ({type(error).__name__})", file=sys.stderr)
        return EXIT_REDIS_UNREACHABLE
    finally:
        client.close()
    return EXIT_OK if succeeded else EXIT_UNEXPECTED_OUTCOME


if __name__ == "__main__":
    raise SystemExit(main())
