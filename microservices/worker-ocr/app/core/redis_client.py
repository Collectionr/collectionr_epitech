from redis import Redis

from app.core.config import Settings

# A blocking read waits up to OCR_QUEUE_BLOCK_TIMEOUT on the server: the socket must
# outlive it, otherwise every idle read would end in a client-side timeout.
SOCKET_TIMEOUT_MARGIN_SECONDS = 5.0


def create_redis_client(settings: Settings) -> Redis:
    """Builds the Redis OCR client. No connection is opened before the first command."""
    return Redis.from_url(
        settings.redis_url.get_secret_value(),
        decode_responses=True,
        socket_connect_timeout=settings.redis_connect_timeout,
        socket_timeout=settings.ocr_queue_block_timeout + SOCKET_TIMEOUT_MARGIN_SECONDS,
    )
