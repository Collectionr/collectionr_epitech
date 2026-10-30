import io
import json
import logging
import re
from collections.abc import Iterator

import pytest

from tcg_service.infrastructure.logging.json_logging import (
    UVICORN_LOGGERS,
    AccessLogFilter,
    JsonFormatter,
    configure_logging,
)

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
    configure_logging("warning")

    logging.getLogger("tcg_service.test").info("hidden")
    logging.getLogger("tcg_service.test").warning("shown")

    assert [entry["msg"] for entry in lines(stdout)] == ["shown"]


def test_extra_fields_and_exceptions_are_kept(stdout: Stdout) -> None:
    configure_logging("info")
    logger = logging.getLogger("tcg_service.test")

    try:
        raise ValueError("boom")
    except ValueError:
        logger.exception("sync failed", extra={"card_count": 3})

    [entry] = lines(stdout)
    assert entry["level"] == "error"
    assert entry["card_count"] == 3
    assert "ValueError: boom" in str(entry["exc_info"])


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


def test_access_log_filter_leaves_other_records_untouched() -> None:
    record = logging.makeLogRecord({"msg": "plain %s", "args": ("message",)})

    assert AccessLogFilter().filter(record)
    assert record.getMessage() == "plain message"


def test_formatter_serializes_non_json_values() -> None:
    record = logging.makeLogRecord({"msg": "ok", "payload": object()})

    assert "object object" in json.loads(JsonFormatter().format(record))["payload"]
