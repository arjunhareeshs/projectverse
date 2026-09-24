import type { ErrorRequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HttpError } from '../shared/http';
import { logger } from '../shared/logger';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof HttpError) {
    if (error.statusCode >= 500) {
      logger.error(`${req.method} ${req.path} — ${error.message}`, {
        source: 'http.errorHandler',
        userId: (req as any).user?.id,
        stack: error.stack,
      });
    }
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  logger.error(`${req.method} ${req.path} — Unhandled error: ${error?.message || error}`, {
    source: 'http.errorHandler',
    userId: (req as any).user?.id,
    stack: error?.stack,
  });

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
};
