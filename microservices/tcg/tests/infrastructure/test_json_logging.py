import io
import json
import logging
import re
import threading
import time
from collections.abc import Iterator
from http.client import HTTPConnection

import pytest
import uvicorn

from tcg_service.config import Settings
from tcg_service.infrastructure.logging.json_logging import (
    UVICORN_LOGGERS,
    AccessLogFilter,
    JsonFormatter,
    configure_logging,
)
from tcg_service.interface.api.app import create_app
from tests.conftest import FakeDatabase

JS_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


@pytest.fixture
def stdout(
    capsys: pytest.CaptureFixture[str],
) -> Iterator[pytest.CaptureFixture[str]]:
    """Captures stdout and restores the logging setup touched by configure_logging."""
    root = logging.getLogger()
    saved_root = (root.handlers[:], root.level)
    saved_uvicorn = {
        name: (
            logging.getLogger(name).handlers[:],
            logging.getLogger(name).propagate,
            logging.getLogger(name).filters[:],
        )
        for name in UVICORN_LOGGERS
    }
    yield capsys
    root.handlers[:], level = saved_root
    root.setLevel(level)
    for name, (handlers, propagate, filters) in saved_uvicorn.items():
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers[:] = handlers
        uvicorn_logger.propagate = propagate
        uvicorn_logger.filters[:] = filters


Stdout = pytest.CaptureFixture[str]


def lines(stdout: Stdout) -> list[dict[str, object]]:
    return [json.loads(line) for line in stdout.readouterr().out.splitlines()]


def test_each_log_is_one_json_line_with_the_s05_fields(stdout: Stdout) -> None:
    configure_logging("info")

    logging.getLogger("tcg_service.test").info("sync %s done", "cards")

    [entry] = lines(stdout)
    assert entry["level"] == "info"
    assert entry["service"] == "tcg"
    assert entry["logger"] == "tcg_service.test"
    assert entry["msg"] == "sync cards done"
    assert JS_ISO_DATE.match(str(entry["time"]))


def test_level_below_log_level_is_dropped(stdout: Stdout) -> None:
    configure_logging("warn")

    logging.getLogger("tcg_service.test").info("hidden")
    logging.getLogger("tcg_service.test").warning("shown")

    assert [entry["msg"] for entry in lines(stdout)] == ["shown"]


def test_levels_are_named_like_the_backend(stdout: Stdout) -> None:
    configure_logging("trace")
    logger = logging.getLogger("tcg_service.test")

    logger.warning("w")
    logger.critical("c")

    assert [entry["level"] for entry in lines(stdout)] == ["warn", "fatal"]


@pytest.mark.parametrize(
    ("log_level", "expected"),
    [("fatal", ["c"]), ("error", ["e", "c"]), ("debug", ["d", "e", "c"])],
)
def test_backend_log_levels_filter_like_their_python_counterpart(
    stdout: Stdout, log_level: str, expected: list[str]
) -> None:
    configure_logging(log_level)
    logger = logging.getLogger("tcg_service.test")

    logger.debug("d")
    logger.error("e")
    logger.critical("c")

    assert [entry["msg"] for entry in lines(stdout)] == expected


def test_extra_fields_are_kept(stdout: Stdout) -> None:
    configure_logging("info")

    logging.getLogger("tcg_service.test").info("synced", extra={"card_count": 3})

    [entry] = lines(stdout)
    assert entry["card_count"] == 3


def test_exceptions_are_logged_without_their_message(stdout: Stdout) -> None:
    configure_logging("info")
    logger = logging.getLogger("tcg_service.test")
    # Built outside the raise line: the stack trace shows source lines.
    error = ValueError('connection to "db.invalid" failed for user "tcg_user"')

    try:
        raise error
    except ValueError:
        logger.exception("sync failed")

    [entry] = lines(stdout)
    assert entry["level"] == "error"
    assert entry["exc_type"] == "ValueError"
    assert "test_exceptions_are_logged_without_their_message" in str(
        entry["stack_trace"]
    )
    assert "exc_info" not in entry
    assert "db.invalid" not in json.dumps(entry)
    assert "tcg_user" not in json.dumps(entry)


def test_exc_info_without_a_current_exception_adds_nothing(stdout: Stdout) -> None:
    configure_logging("info")

    logging.getLogger("tcg_service.test").error("no exception", exc_info=True)

    [entry] = lines(stdout)
    assert "exc_type" not in entry
    assert "stack_trace" not in entry


def test_uvicorn_logs_go_through_the_json_handler(stdout: Stdout) -> None:
    logging.getLogger("uvicorn.error").addHandler(logging.StreamHandler(io.StringIO()))
    configure_logging("info")

    logging.getLogger("uvicorn.error").info(
        "Started server process [%d]",
        1,
        extra={"color_message": "Started server process [\x1b[36m%d\x1b[0m]"},
    )

    assert not logging.getLogger("uvicorn.error").handlers
    [entry] = lines(stdout)
    assert entry["logger"] == "uvicorn.error"
    assert entry["msg"] == "Started server process [1]"
    assert "color_message" not in entry


def test_access_logs_never_contain_the_client_address(stdout: Stdout) -> None:
    configure_logging("info")

    logging.getLogger("uvicorn.access").info(
        '%s - "%s %s HTTP/%s" %d', "203.0.113.7:51234", "GET", "/health", "1.1", 200
    )

    [entry] = lines(stdout)
    assert "203.0.113.7" not in json.dumps(entry)
    assert entry["msg"] == "GET /health 200"
    assert (entry["http_method"], entry["http_path"], entry["status_code"]) == (
        "GET",
        "/health",
        200,
    )


@pytest.mark.parametrize("protocol", ["h11", "httptools"])
def test_real_uvicorn_access_logs_never_contain_the_client_address(
    stdout: Stdout, settings: Settings, protocol: str
) -> None:
    # Real server: fails if uvicorn changes the access log format AccessLogFilter
    # depends on (the filter would then drop every access log).
    app = create_app(settings, FakeDatabase())
    config = uvicorn.Config(
        app, host="127.0.0.1", port=0, http=protocol, log_config=None
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 10
        while not server.started:
            assert time.monotonic() < deadline, "uvicorn did not start"
            time.sleep(0.01)
        port = server.servers[0].sockets[0].getsockname()[1]
        connection = HTTPConnection("127.0.0.1", port, timeout=5)
        connection.request("GET", "/health?probe=1")
        assert connection.getresponse().status == 200
        connection.close()
    finally:
        server.should_exit = True
        thread.join(timeout=10)

    access = [entry for entry in lines(stdout) if entry["logger"] == "uvicorn.access"]
    assert [entry["msg"] for entry in access] == ["GET /health?probe=1 200"]
    assert "127.0.0.1" not in json.dumps(access)


def test_access_log_with_an_unknown_format_is_dropped() -> None:
    record = logging.makeLogRecord(
        {"msg": "%s - %s", "args": ("203.0.113.7:51234", "GET /health 200")}
    )

    assert not AccessLogFilter().filter(record)


def test_formatter_serializes_non_json_values() -> None:
    record = logging.makeLogRecord({"msg": "ok", "payload": object()})

    assert "object object" in json.loads(JsonFormatter().format(record))["payload"]
