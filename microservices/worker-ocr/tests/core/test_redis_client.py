from app.core.redis_client import SOCKET_TIMEOUT_MARGIN_SECONDS, create_redis_client
from tests.conftest import build_settings


def test_client_is_built_from_the_settings_without_connecting() -> None:
    settings = build_settings(
        redis_url="redis://:secret@redis-ocr:6380/2",
        redis_connect_timeout=3,
        ocr_queue_block_timeout=10,
    )

    client = create_redis_client(settings)

    options = client.connection_pool.connection_kwargs
    assert options["host"] == "redis-ocr"
    assert options["port"] == 6380
    assert options["db"] == 2
    assert options["decode_responses"] is True
    assert options["socket_connect_timeout"] == 3
    # A blocking read must not hit the socket timeout before the server answers.
    assert options["socket_timeout"] == 10 + SOCKET_TIMEOUT_MARGIN_SECONDS
