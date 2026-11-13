"""Entry point of the OCR worker: `python -m app.main`."""

import logging
import signal
from types import FrameType

from app.core.config import get_settings
from app.core.json_logging import configure_logging
from app.core.redis_client import create_redis_client
from app.inference.factory import create_engine
from app.jobs.consumer import JobConsumer
from app.jobs.queue import JobQueue
from app.jobs.store import JobStore

logger = logging.getLogger(__name__)

SHUTDOWN_SIGNALS = (signal.SIGINT, signal.SIGTERM)


def install_signal_handlers(consumer: JobConsumer) -> None:
    """SIGTERM (K3s, Docker) and Ctrl+C end the loop after the current job."""

    def request_shutdown(signum: int, _frame: FrameType | None) -> None:
        logger.info("Shutdown requested", extra={"signal": signal.Signals(signum).name})
        consumer.stop()

    for shutdown_signal in SHUTDOWN_SIGNALS:
        signal.signal(shutdown_signal, request_shutdown)


def main() -> int:
    settings = get_settings()
    configure_logging(settings.log_level)

    # The model is loaded once, before any job is taken.
    engine = create_engine(settings)
    engine.load()

    client = create_redis_client(settings)
    consumer = JobConsumer(
        queue=JobQueue(client),
        store=JobStore(client, ttl=settings.ocr_result_ttl),
        engine=engine,
        block_timeout=settings.ocr_queue_block_timeout,
        max_attempts=settings.ocr_job_max_attempts,
    )
    install_signal_handlers(consumer)
    try:
        consumer.run()
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
