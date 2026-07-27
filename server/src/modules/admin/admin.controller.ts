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

  // ── Trends ────────────────────────────────────────────────────────────────

  getTeamTrends: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await AdminService.getTeamTrends();
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  getStudentTrends: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await AdminService.getStudentTrends();
      res.json(data);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // ── Chat ──────────────────────────────────────────────────────────────────

  saveChat: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { prompt, response, sessionId } = req.body;
      const chat = await AdminService.saveAdminChat(req.user!.id, prompt, response, sessionId);
      res.status(StatusCodes.CREATED).json(chat);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  getChatHistory: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const history = await AdminService.getAdminChatHistory(req.user!.id);
      res.json(history);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  getChatSessions: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessions = await AdminService.getAdminChatSessions(req.user!.id);
      res.json(sessions);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  searchContext: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = String(req.query.q || '');
      if (!query) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Query is required' });
        return;
      }
      const results = await AdminService.searchContext(query);
      res.json(results);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  getTeamDetail: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const team = await AdminService.getTeamDetail(req.params.id as string);
      if (!team) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Team not found' });
        return;
      }
      res.json(team);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  getStudentDetail: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const student = await AdminService.getStudentDetail(req.params.id as string);
      if (!student) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Student not found' });
        return;
      }
      res.json(student);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },
};
