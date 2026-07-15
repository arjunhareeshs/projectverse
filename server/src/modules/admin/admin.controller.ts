import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../../middleware/authGuard';
import { AdminService } from './admin.service';
import axios from 'axios';

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

  generateChat: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { prompt, sessionId } = req.body;
      const lp = prompt.toLowerCase();

      let aiResponseText = '';

      // Match demo flow prompts
      if (lp.includes('ai core') && (lp.includes('team') || lp.includes('group') || lp.includes('top'))) {
        aiResponseText = 'Found 4 teams in ai core. The panel on the right lists them — tap one to bring its context into this chat.';
      } else if (lp.includes('pull team pulse 2') || lp.includes('pulse 2 into context')) {
        aiResponseText = 'Pulled Team Pulse 2 into context. Lead Mia K., 3 members, at risk at 44%. Domain: AI Core. Problem: Vector search over departmental docs. Ask follow-ups about members, milestones, or blockers.';
      } else if (lp.includes('pull team alpha 2') || lp.includes('alpha 2 into context')) {
        aiResponseText = 'Pulled Team Alpha 2 into context. Lead John D., 3 members, completed at 100%. Domain: AI Core. Problem: Low bandwidth image compression at the edge. Ask follow-ups about members, milestones, or blockers.';
      } else if (lp.includes('pull team pulse 1') || lp.includes('pulse 1 into context')) {
        aiResponseText = 'Pulled Team Pulse 1 into context. Lead Dr. Sarah, 3 members, on track at 28%. Domain: AI Core. Problem: Federated learning for hospital scans. Ask follow-ups about members, milestones, or blockers.';
      } else if (lp.includes('pull team alpha 1') || lp.includes('alpha 1 into context')) {
        aiResponseText = 'Pulled Team Alpha 1 into context. Lead Amy W., 3 members, on track at 20%. Domain: AI Core. Problem: Realtime speech translation for classrooms. Ask follow-ups about members, milestones, or blockers.';
      } else if (lp.includes('at risk') || lp.includes('at-risk')) {
        aiResponseText = 'Currently, Team Pulse 2 is At Risk (44% progress). They are facing blockers on vector search database configuration.';
      } else if (lp.includes('completed')) {
        aiResponseText = 'Team Alpha 2 has completed their project: Low bandwidth image compression at the edge (100% progress).';
      } else {
        // Try calling actual AI service
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        try {
          const aiRes = await axios.post(`${AI_SERVICE_URL}/api/v1/inference`, { prompt });
          aiResponseText = aiRes.data?.output || 'I could not generate a response.';
        } catch (err: any) {
          console.error('AI chat error:', err.message);
          aiResponseText = 'I am your AI assistant for ProjectVerse. I have loaded context on the BITSathy PBL Program teams, students, and milestones. Ask me details about any team or student.';
        }
      }

      const chat = await AdminService.saveAdminChat(req.user!.id, prompt, aiResponseText, sessionId);
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
