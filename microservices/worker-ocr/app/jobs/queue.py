from redis import Redis

from app.jobs.keys import PENDING_QUEUE_KEY, PROCESSING_QUEUE_KEY
from app.jobs.models import Job
from app.jobs.replies import as_int, as_text


class JobQueue:
    """FIFO queue of OCR jobs on a Redis list (reliable queue pattern).

    The producer pushes at the head, the worker takes from the tail: first in, first
    out. Taking a job moves it to a processing list in the same atomic command, so a
    job still exists in Redis if the worker dies while processing it.

    The processing list is shared: `requeue_interrupted` assumes a single worker.
    """

    def __init__(self, client: Redis) -> None:
        self._client = client

    def enqueue(self, job: Job) -> None:
        """Producer side: adds a job at the end of the queue."""
        self._client.lpush(PENDING_QUEUE_KEY, job.model_dump_json())

    def claim(self, timeout: int) -> str | None:
        """Takes the oldest job, waiting up to `timeout` seconds. None if none came."""
        return as_text(
            self._client.blmove(
                PENDING_QUEUE_KEY,
                PROCESSING_QUEUE_KEY,
                timeout,
                src="RIGHT",
                dest="LEFT",
            )
        )

    def ack(self, message: str) -> None:
        """Forgets a claimed job once it is over."""
        self._client.lrem(PROCESSING_QUEUE_KEY, 1, message)

    def requeue_interrupted(self) -> int:
        """Puts the jobs a previous run left unfinished back in front of the queue.

        Returns how many jobs were put back. Their order is kept.
        """
        count = 0
        # Most recently claimed first: the oldest one ends up at the very tail.
        while (
            as_text(
                self._client.lmove(
                    PROCESSING_QUEUE_KEY, PENDING_QUEUE_KEY, src="LEFT", dest="RIGHT"
                )
            )
            is not None
        ):
            count += 1
        return count

    def pending_count(self) -> int:
        return as_int(self._client.llen(PENDING_QUEUE_KEY))
