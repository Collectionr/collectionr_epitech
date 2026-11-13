"""Structured logs: one JSON line per event on stdout (S05), read by Loki/Grafana.

Same format as the backend and the TCG microservice: `time`, `level`, `service`,
`logger`, `msg`, then the fields passed through `extra=`.
"""

import json
import logging
import sys
from datetime import UTC, datetime
from traceback import format_tb
from typing import Any

SERVICE_NAME = "worker-ocr"

# Level names are the backend's (pino): WARNING and CRITICAL are written warn, fatal.
_PINO_LEVEL_NAMES = {"warning": "warn", "critical": "fatal"}
# LOG_LEVEL values that are not Python level names (Python has nothing below DEBUG).
_PYTHON_LEVEL_NAMES = {"fatal": "CRITICAL", "warn": "WARNING", "trace": "DEBUG"}

# Attributes every LogRecord has: anything else was passed through `extra=`.
_IGNORED_RECORD_ATTRIBUTES = frozenset(
    [*logging.makeLogRecord({}).__dict__, "message", "asctime"]
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
                # Type and call stack only, never the message: a Redis error message
                # may contain the host or the URL of the instance.
                payload["exc_type"] = exc_type.__qualname__
                payload["stack_trace"] = "".join(format_tb(exc_traceback))
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(level: str) -> None:
    """Routes every log through one JSON handler on stdout."""
    python_level = _PYTHON_LEVEL_NAMES.get(level, level.upper())
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.setLevel(python_level)

    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(python_level)
