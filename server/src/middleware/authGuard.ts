import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { verifyAccessToken } from '../config/jwt';
import { prisma } from '../shared/database';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export async function authGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.headers.authorization?.replace('Bearer ', '');
  if (!token && req.query['token']) {
    token = req.query['token'] as string;
  }

  if (!token) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Missing access token' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.sub }
    });
    
    if (!user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User no longer exists' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid access token' });
  }
}

export function requireRole(role: 'ADMIN' | 'STUDENT' | string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden: Insufficient privileges' });
      return;
    }
    next();
  };
}
