import json
import logging
import re
from collections.abc import Iterator

import pytest

from app.core.json_logging import configure_logging

JS_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")
# Defined away from the `raise`: the stack trace quotes the source line that raises.
LEAKY_MESSAGE = "Error 111 connecting to redis-ocr:6379"

Stdout = pytest.CaptureFixture[str]


@pytest.fixture
def stdout(capsys: Stdout) -> Iterator[Stdout]:
    """Captures stdout and restores the logging setup touched by configure_logging."""
    root = logging.getLogger()
    saved_handlers, saved_level = root.handlers[:], root.level
    yield capsys
    root.handlers[:] = saved_handlers
    root.setLevel(saved_level)


def lines(stdout: Stdout) -> list[dict[str, object]]:
    return [json.loads(line) for line in stdout.readouterr().out.splitlines()]


def test_each_log_is_one_json_line_with_the_s05_fields(stdout: Stdout) -> None:
    configure_logging("info")

    logging.getLogger("app.test").info("job %s done", "42")

    [entry] = lines(stdout)
    assert entry["level"] == "info"
    assert entry["service"] == "worker-ocr"
    assert entry["logger"] == "app.test"
    assert entry["msg"] == "job 42 done"
    assert JS_ISO_DATE.match(str(entry["time"]))


def test_extra_fields_are_added_as_is(stdout: Stdout) -> None:
    configure_logging("info")

    logging.getLogger("app.test").info(
        "Job finished", extra={"job_id": "abc", "duration_ms": 12}
    )

    [entry] = lines(stdout)
    assert entry["job_id"] == "abc"
    assert entry["duration_ms"] == 12


def test_level_names_are_the_backend_ones(stdout: Stdout) -> None:
    configure_logging("trace")
    logger = logging.getLogger("app.test")

    logger.warning("careful")
    logger.critical("broken")

    assert [entry["level"] for entry in lines(stdout)] == ["warn", "fatal"]


def test_logs_below_the_configured_level_are_dropped(stdout: Stdout) -> None:
    configure_logging("warn")

    logging.getLogger("app.test").info("ignored")

    assert lines(stdout) == []


def test_an_exception_is_logged_by_type_and_stack_never_by_message(
    stdout: Stdout,
) -> None:
    configure_logging("info")

    try:
        raise ConnectionError(LEAKY_MESSAGE)
    except ConnectionError:
        logging.getLogger("app.test").exception("Redis failed")

    [entry] = lines(stdout)
    assert entry["exc_type"] == "ConnectionError"
    assert "test_json_logging.py" in str(entry["stack_trace"])
    assert "redis-ocr" not in json.dumps(entry)
