import type { ErrorRequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HttpError } from '../shared/http';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
};
