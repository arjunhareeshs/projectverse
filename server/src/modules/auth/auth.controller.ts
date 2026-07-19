import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from '../../middleware/authGuard';
import { prisma } from '../../shared/database';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const result = await AuthService.register(req.body);
      res.status(StatusCodes.CREATED).json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'Invalid request', issues: error.issues });
      } else if (error.message?.includes('already exists')) {
        res.status(StatusCodes.CONFLICT).json({ message: error.message });
      } else {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Registration failed' });
      }
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const result = await AuthService.login(req.body);
      res.status(StatusCodes.OK).json(result);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error instanceof ZodError) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'Invalid request', issues: error.issues });
      } else {
        // Keep error message generic to avoid user-enumeration
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
      }
    }
  }

  static async me(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
        return;
      }
      const result = await AuthService.me(userId);
      res.status(StatusCodes.OK).json(result);
    } catch (error: any) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
    }
  }

  static async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const users = await prisma.user.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      });
      res.json(users);
    } catch (error) {
      console.error('Error fetching org users:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch users' });
    }
  }
}
