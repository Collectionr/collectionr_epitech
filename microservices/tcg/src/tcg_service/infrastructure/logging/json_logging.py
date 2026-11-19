"""Structured logs: one JSON line per event on stdout (S05), read by Loki/Grafana."""

import json
import logging
import sys
from datetime import UTC, datetime
from traceback import format_tb
from typing import Any

SERVICE_NAME = "tcg"
UVICORN_LOGGERS = ("uvicorn", "uvicorn.error", "uvicorn.access")

# Level names are the backend's (pino): WARNING and CRITICAL are written warn, fatal.
_PINO_LEVEL_NAMES = {"warning": "warn", "critical": "fatal"}
# LOG_LEVEL values that are not Python level names (Python has nothing below DEBUG).
_PYTHON_LEVEL_NAMES = {"fatal": "CRITICAL", "warn": "WARNING", "trace": "DEBUG"}

# Attributes every LogRecord has: anything else was passed through `extra=`.
# color_message is uvicorn's copy of the message with ANSI color codes.
_IGNORED_RECORD_ATTRIBUTES = frozenset(
    [*logging.makeLogRecord({}).__dict__, "message", "asctime", "color_message"]
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        level = record.levelname.lower()
        payload: dict[str, Any] = {
            "time": datetime.fromtimestamp(record.created, UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": _PINO_LEVEL_NAMES.get(level, level),
            "service": SERVICE_NAME,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        payload.update(
            (key, value)
            for key, value in record.__dict__.items()
            if key not in _IGNORED_RECORD_ATTRIBUTES and key not in payload
        )
        if record.exc_info:
            exc_type, _, exc_traceback = record.exc_info
            if exc_type is not None:
                # Type and call stack only, never the message: a libpq message may
                # contain the database user or host.
                payload["exc_type"] = exc_type.__qualname__
                payload["stack_trace"] = "".join(format_tb(exc_traceback))
        return json.dumps(payload, default=str, ensure_ascii=False)


class AccessLogFilter(logging.Filter):
    """Drops the client address from uvicorn access logs: an IP is personal data.

    Depends on uvicorn's access log call (uvicorn 0.54, h11 and httptools):
    `'%s - "%s %s HTTP/%s" %d'` with (client address, method, path, HTTP version,
    status code). If that format changes, the real-server test in
    tests/infrastructure/test_json_logging.py fails; meanwhile a record of any other
    shape is dropped instead of being logged with a possible IP.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if not (isinstance(record.args, tuple) and len(record.args) == 5):
            return False
        _, method, path, _, status_code = record.args
        record.msg = "%s %s %s"
        record.args = (method, path, status_code)
        record.http_method = method
        record.http_path = path
        record.status_code = status_code
        return True


def configure_logging(level: str) -> None:
    """Routes every log, uvicorn's included, through one JSON handler on stdout."""
    python_level = _PYTHON_LEVEL_NAMES.get(level, level.upper())
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.setLevel(python_level)

    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(python_level)

    # uvicorn installs its own text handlers before calling the app factory.
    for name in UVICORN_LOGGERS:
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True

    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, AccessLogFilter) for f in access_logger.filters):
        access_logger.addFilter(AccessLogFilter())
