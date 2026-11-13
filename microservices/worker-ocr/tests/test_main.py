import signal
from collections.abc import Callable, Iterator
from types import FrameType

import pytest
from redis import Redis

from app import main as main_module
from app.core.config import Settings, get_settings
from app.jobs.consumer import JobConsumer
from app.jobs.models import JobStatus
from tests.conftest import REDIS_URL, ScriptedEngine, build_consumer

SignalHandler = Callable[[int, FrameType | None], None]


@pytest.fixture
def environment(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("REDIS_URL", REDIS_URL)
    monkeypatch.setenv("OCR_QUEUE_BLOCK_TIMEOUT", "7")
    monkeypatch.setenv("OCR_JOB_MAX_ATTEMPTS", "4")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_main_runs_the_consumer_then_closes_redis(
    environment: None, monkeypatch: pytest.MonkeyPatch, redis_client: Redis
) -> None:
    events: list[str] = []
    consumers: list[JobConsumer] = []

    def fake_client(settings: Settings) -> Redis:
        assert settings.redis_url.get_secret_value() == REDIS_URL
        return redis_client

    def fake_run(consumer: JobConsumer) -> None:
        consumers.append(consumer)
        events.append("run")

    monkeypatch.setattr(main_module, "create_redis_client", fake_client)
    monkeypatch.setattr(main_module, "configure_logging", lambda level: None)
    monkeypatch.setattr(
        main_module,
        "install_signal_handlers",
        lambda consumer: events.append("signals"),
    )
    monkeypatch.setattr(JobConsumer, "run", fake_run)
    monkeypatch.setattr(redis_client, "close", lambda: events.append("close"))

    assert main_module.main() == 0

    assert events == ["signals", "run", "close"]
    [consumer] = consumers
    assert consumer._engine.name == "stub"
    assert consumer._block_timeout == 7
    assert consumer._max_attempts == 4


def test_redis_is_closed_even_if_the_consumer_crashes(
    environment: None, monkeypatch: pytest.MonkeyPatch, redis_client: Redis
) -> None:
    closed: list[bool] = []

    def crash(consumer: JobConsumer) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(main_module, "create_redis_client", lambda _: redis_client)
    monkeypatch.setattr(main_module, "configure_logging", lambda level: None)
    monkeypatch.setattr(main_module, "install_signal_handlers", lambda consumer: None)
    monkeypatch.setattr(JobConsumer, "run", crash)
    monkeypatch.setattr(redis_client, "close", lambda: closed.append(True))

    with pytest.raises(RuntimeError):
        main_module.main()

    assert closed == [True]


def test_shutdown_signals_stop_the_consumer(
    monkeypatch: pytest.MonkeyPatch, redis_client: Redis
) -> None:
    handlers: dict[int, SignalHandler] = {}
    monkeypatch.setattr(signal, "signal", handlers.__setitem__)
    engine = ScriptedEngine()
    consumer, queue, store = build_consumer(redis_client, engine)
    store.set_status("card-1", JobStatus.PENDING)
    redis_client.lpush(
        "queue:ocr:pending", '{"job_id": "card-1", "image_path": "card-1.jpg"}'
    )

    main_module.install_signal_handlers(consumer)
    assert set(handlers) == {signal.SIGINT, signal.SIGTERM}
    handlers[signal.SIGTERM](signal.SIGTERM, None)
    consumer.run()

    # Stop was requested before the loop started: the job is left for the next run.
    assert engine.calls == []
    assert queue.pending_count() == 1
