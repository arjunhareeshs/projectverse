import type { NextFunction, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from './authGuard';

export function requireRole(allowedRoles: string | string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      return;
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(req.user.role)) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden: Insufficient permissions' });
      return;
    }

    next();
  };
}
