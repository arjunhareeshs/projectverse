import contextvars
import json
import logging
import sys
import uuid

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar('request_id', default='-')

_STANDARD_RECORD_ATTRS = frozenset(logging.LogRecord('', 0, '', 0, '', (), None).__dict__) | {'message', 'asctime'}


def new_request_id() -> str:
    return uuid.uuid4().hex[:16]


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            'ts': self.formatTime(record, '%Y-%m-%dT%H:%M:%S%z'),
            'level': record.levelname,
            'logger': record.name,
            'request_id': request_id_var.get(),
            'message': record.getMessage(),
        }
        # Structured fields passed via `logger.info(msg, extra={...})` — e.g. the tool audit log
        # (Stage 7) needs {tool_name, args, identity, result_summary} to actually be greppable
        # JSON fields, not buried inside an escaped message string.
        for key, value in record.__dict__.items():
            if key not in _STANDARD_RECORD_ATTRS:
                payload[key] = value
        if record.exc_info:
            payload['exc_info'] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers = [handler]
