from typing import Any


class AppError(Exception):
    """Base class for errors that map to a specific HTTP response."""

    status_code = 500
    error_code = 'internal_error'

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        error_code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if error_code is not None:
            self.error_code = error_code
        self.details = details or {}


class UnauthorizedError(AppError):
    status_code = 401
    error_code = 'unauthorized'


class ForbiddenError(AppError):
    status_code = 403
    error_code = 'forbidden'


class BadRequestError(AppError):
    status_code = 400
    error_code = 'bad_request'


class NotFoundError(AppError):
    status_code = 404
    error_code = 'not_found'


class UpstreamError(AppError):
    """Raised when a call to Node, Groq, Qdrant, etc. fails."""

    status_code = 502
    error_code = 'upstream_error'
