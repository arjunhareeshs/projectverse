import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Validation error',
        errors: result.error.issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export async function requireProjectAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authentication required' });
      return;
    }

    if (user.role === 'ADMIN' || user.role === 'FACULTY') {
      next();
      return;
    }

    const projectId = req.params.projectId as string | undefined;
    if (!projectId) {
      next();
      return;
    }

    const member = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
      },
    });

    if (member) {
      next();
      return;
    }

    // Secondary check: check if user belongs to project's team
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true },
    });

    if (project?.teamId && user.teamId === project.teamId) {
      next();
      return;
    }

    res.status(StatusCodes.FORBIDDEN).json({ message: 'Access denied: You are not a member of this project' });
  } catch (err: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
  }
}
