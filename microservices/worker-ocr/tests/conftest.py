from collections.abc import Callable

import fakeredis
import pytest
from pydantic import JsonValue
from redis import Redis

from app.core.config import Settings
from app.inference.engine import InferenceError
from app.jobs.consumer import JobConsumer
from app.jobs.queue import JobQueue
from app.jobs.store import JobStore

REDIS_URL = "redis://:secret@localhost:6379/0"
RESULT_TTL = 120


def build_settings(**overrides: object) -> Settings:
    """Settings built from explicit values only: no `.env`, no surprise."""
    return Settings(_env_file=None, **{"redis_url": REDIS_URL, **overrides})  # type: ignore[arg-type]


class ScriptedEngine:
    """Engine double: the image file name decides what happens."""

    name = "scripted"

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.on_predict: Callable[[str], None] = lambda image_path: None

    def load(self) -> None:
        """Nothing to load."""

    def predict(self, image_path: str) -> dict[str, JsonValue]:
        self.calls.append(image_path)
        self.on_predict(image_path)
        if "fail" in image_path:
            raise InferenceError("Unreadable image")
        if "crash" in image_path:
            raise RuntimeError("CUDA out of memory on device 0")
        return {"name": "Pikachu"}


class DrainingQueue(JobQueue):
    """Calls `on_empty` instead of blocking once no job is waiting.

    Wired to `JobConsumer.stop`, it makes `run()` return when the queue is drained.
    """

    def __init__(self, client: Redis) -> None:
        super().__init__(client)
        self.on_empty: Callable[[], None] = lambda: None

    def claim(self, timeout: int) -> str | None:
        if self.pending_count() == 0:
            self.on_empty()
            return None
        return super().claim(timeout)


def build_consumer(
    client: Redis, engine: ScriptedEngine, *, max_attempts: int = 3
) -> tuple[JobConsumer, DrainingQueue, JobStore]:
    """A consumer whose `run()` processes the waiting jobs, then returns."""
    queue = DrainingQueue(client)
    store = JobStore(client, ttl=RESULT_TTL)
    consumer = JobConsumer(
        queue, store, engine, block_timeout=1, max_attempts=max_attempts
    )
    queue.on_empty = consumer.stop
    return consumer, queue, store


@pytest.fixture
def redis_client() -> Redis:
    """In-memory Redis: the unit tests need no real instance."""
    return fakeredis.FakeRedis(decode_responses=True)
