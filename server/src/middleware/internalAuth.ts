import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const MAX_SKEW_SECONDS = 60;

function computeInternalSignature(secret: string, userId: string, role: string, timestamp: string): string {
  const message = `${userId}.${role}.${timestamp}`;
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

export interface InternalRequest extends Request {
  internalUser?: {
    userId: string;
    role: string;
    teamId?: string;
    orgId?: string;
  };
}

export function internalAuth(req: InternalRequest, res: Response, next: NextFunction): void {
  const secret = process.env['INTERNAL_TOKEN_SECRET'];
  if (!secret) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal token secret not configured' });
    return;
  }

  const userId = req.headers['x-internal-user-id'] as string | undefined;
  const role = req.headers['x-internal-role'] as string | undefined;
  const timestamp = req.headers['x-internal-timestamp'] as string | undefined;
  const token = req.headers['x-internal-token'] as string | undefined;

  if (!userId || !role || !timestamp || !token) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Missing internal identity headers' });
    return;
  }

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Internal token expired or invalid timestamp' });
    return;
  }

  const expected = computeInternalSignature(secret, userId, role, timestamp);
  const isValid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  if (!isValid) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid internal token signature' });
    return;
  }

  req.internalUser = {
    userId,
    role,
    teamId: req.headers['x-internal-team-id'] as string | undefined,
    orgId: req.headers['x-internal-org-id'] as string | undefined,
  };

  next();
}
