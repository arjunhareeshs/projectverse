import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../../middleware/authGuard';
import { AdminService } from './admin.service';

export const adminController = {
  // ── Stats ────────────────────────────────────────────────────────────────

  getStats: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await AdminService.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // ── Users ────────────────────────────────────────────────────────────────

  updateUserRole: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.params.userId as string;
      const { role } = req.body as { role?: string };
      if (!role || !['ADMIN', 'STUDENT', 'FACULTY'].includes(role)) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'role must be one of ADMIN, STUDENT, FACULTY' });
        return;
      }
      const user = await AdminService.updateUserRole(userId, role as 'ADMIN' | 'STUDENT' | 'FACULTY');
      res.json(user);
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  },

  // ── Proposals ────────────────────────────────────────────────────────────

  getProposals: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { verdict, studentId, page, limit } = req.query as {
        verdict?: string;
        studentId?: string;
        page?: string;
        limit?: string;
      };
      const result = await AdminService.getProposals(
        { verdict, studentId },
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : 50,
      );
      res.json(result);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // ── Students ─────────────────────────────────────────────────────────────

  createStudent: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const student = await AdminService.createStudent(req.body);
      res.status(StatusCodes.CREATED).json(student);
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  },

  getStudents: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(String(req.query.page || '1'));
      const limit = parseInt(String(req.query.limit || '50'));
      const data = await AdminService.getStudents(page, limit);
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  bulkUploadStudents: async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'No file uploaded' });
        return;
      }
      const results = await AdminService.bulkUploadStudents(req.file.buffer);
      res.json(results);
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  },

  // ── Teams ─────────────────────────────────────────────────────────────────

  createTeam: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const team = await AdminService.createTeam({
        ...req.body,
        organizationId: req.user?.organizationId,
      });
      res.status(StatusCodes.CREATED).json(team);
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  },

  getTeams: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(String(req.query.page || '1'));
      const limit = parseInt(String(req.query.limit || '50'));
      const data = await AdminService.getTeams(page, limit);
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  bulkUploadTeams: async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'No file uploaded' });
        return;
      }
      const results = await AdminService.bulkUploadTeams(req.file.buffer);
      res.json(results);
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  },

  // ── Achievements ──────────────────────────────────────────────────────────

  createAchievement: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const achievement = await AdminService.createAchievement(req.body);
      res.status(StatusCodes.CREATED).json(achievement);
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  },

  getAchievements: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(String(req.query.page || '1'));
      const limit = parseInt(String(req.query.limit || '50'));
      const data = await AdminService.getAchievements(page, limit);
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  bulkUploadAchievements: async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'No file uploaded' });
        return;
      }
      const results = await AdminService.bulkUploadAchievements(req.file.buffer);
      res.json(results);
    } catch (err: any) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
    }
  },
};
