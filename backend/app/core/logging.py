"""
Structured JSON logging for FastAPI.
Fields: timestamp, level, service, environment, request_id, method, path, status_code, duration_ms.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings


SERVICE_NAME = "amazon-dashboard-api"


def _sanitize(obj: Any) -> Any:
    """Never log secrets; redact known secret keys."""
    if not isinstance(obj, dict):
        return obj
    redact = {"password", "secret", "token", "authorization", "api_key", "jwt_secret"}
    out: dict[str, Any] = {}
    for k, v in obj.items():
        key_lower = k.lower() if isinstance(k, str) else ""
        if any(r in key_lower for r in redact):
            out[k] = "[REDACTED]"
        else:
            out[k] = _sanitize(v) if isinstance(v, (dict, list)) else v
    return out


class JsonFormatter(logging.Formatter):
    """Format log records as single-line JSON."""

    def __init__(self, service: str, environment: str) -> None:
        super().__init__()
        self.service = service
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        log_dict: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service,
            "environment": self.environment,
        }
        if getattr(record, "request_id", None):
            log_dict["request_id"] = record.request_id
        if getattr(record, "method", None):
            log_dict["method"] = record.method
        if getattr(record, "path", None):
            log_dict["path"] = record.path
        if getattr(record, "status_code", None) is not None:
            log_dict["status_code"] = record.status_code
        if getattr(record, "duration_ms", None) is not None:
            log_dict["duration_ms"] = record.duration_ms
        log_dict["message"] = record.getMessage()
        if record.exc_info:
            log_dict["exception"] = self.formatException(record.exc_info)
        # Extra fields (e.g. from log adapter) - sanitize
        for k, v in record.__dict__.items():
            if k not in (
                "name", "msg", "args", "created", "filename", "funcName", "levelname",
                "levelno", "lineno", "module", "msecs", "pathname", "process", "processName",
                "relativeCreated", "stack_info", "exc_info", "exc_text", "thread", "threadName",
                "message", "asctime", "request_id", "method", "path", "status_code", "duration_ms",
            ):
                log_dict[k] = _sanitize(v) if isinstance(v, (dict, list)) else v
        return json.dumps(log_dict, default=str)


def setup_logging() -> None:
    """Configure root logger with JSON formatter."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(service=SERVICE_NAME, environment=settings.app_env))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
