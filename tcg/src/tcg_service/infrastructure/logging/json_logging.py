"""Structured logs: one JSON line per event on stdout (S05), read by Loki/Grafana."""

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

SERVICE_NAME = "tcg"
UVICORN_LOGGERS = ("uvicorn", "uvicorn.error", "uvicorn.access")

# Attributes every LogRecord has: anything else was passed through `extra=`.
# color_message is uvicorn's copy of the message with ANSI color codes.
_IGNORED_RECORD_ATTRIBUTES = frozenset(
    [*logging.makeLogRecord({}).__dict__, "message", "asctime", "color_message"]
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "time": datetime.fromtimestamp(record.created, UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname.lower(),
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
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


class AccessLogFilter(logging.Filter):
    """Drops the client address from uvicorn access logs: an IP is personal data.

    uvicorn logs `'%s - "%s %s HTTP/%s" %d'` with
    (client address, method, path, HTTP version, status code).
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple) and len(record.args) == 5:
            _, method, path, _, status_code = record.args
            record.msg = "%s %s %s"
            record.args = (method, path, status_code)
            record.http_method = method
            record.http_path = path
            record.status_code = status_code
        return True


def configure_logging(level: str) -> None:
    """Routes every log, uvicorn's included, through one JSON handler on stdout."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.setLevel(level.upper())

    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())

    # uvicorn installs its own text handlers before calling the app factory.
    for name in UVICORN_LOGGERS:
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True

    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, AccessLogFilter) for f in access_logger.filters):
        access_logger.addFilter(AccessLogFilter())
