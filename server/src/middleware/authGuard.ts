import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { verifyAccessToken } from '../config/jwt';
import { prisma } from '../shared/database';

export interface AuthenticatedRequest extends Request {
  user?: any; // Using any for simplicity in this prototype, or type properly if User is exported from prisma
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
    
    // Fetch the user from the database to attach organizationId and other details
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
