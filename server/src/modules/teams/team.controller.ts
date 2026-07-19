import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { teamService } from './team.service';

// Helper: Express v5 types params as string | string[] — narrow to string
function pid(req: Request): string {
  return req.params['id'] as string;
}
function puid(req: Request): string {
  return req.params['userId'] as string;
}
function pinviteId(req: Request): string {
  return req.params['inviteId'] as string;
}
function ptaskId(req: Request): string {
  return req.params['taskId'] as string;
}
function pcollabId(req: Request): string {
  return req.params['collabId'] as string;
}

export const teamController = {
  async getTeams(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const teams = await teamService.getTeams(user.organizationId);
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch teams' });
    }
  },

  async getTeamById(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const team = await teamService.getTeamById(user.organizationId, pid(req));
      if (!team) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Team not found' });
      res.json(team);
    } catch (error) {
      console.error(error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to fetch team details' });
    }
  },

  async createTeam(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const team = await teamService.createTeam(user.organizationId, user.id, user.role, req.body);
      res.status(StatusCodes.CREATED).json(team);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create team' });
    }
  },

  async updateTeam(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const team = await teamService.updateTeam(
        user.organizationId,
        pid(req),
        user.id,
        user.role,
        req.body,
      );
      res.json(team);
    } catch (error: any) {
      console.error(error);
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: error.message || 'Failed to update team' });
    }
  },

  async addMember(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const { userId, roleLabel } = req.body;
      const member = await teamService.addMember(
        user.organizationId,
        pid(req),
        userId,
        roleLabel || 'Member',
      );
      res.json(member);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to add member' });
    }
  },

  async removeMember(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const result = await teamService.removeMember(
        user.organizationId,
        pid(req),
        puid(req),
        user.id,
        user.role,
      );
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: error.message || 'Failed to remove member' });
    }
  },

  async getTeamStats(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const stats = await teamService.getTeamStats(user.organizationId, pid(req));
      res.json(stats);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch team stats' });
    }
  },

  async getCoordinationMetrics(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const metrics = await teamService.getCoordinationMetrics(user.organizationId, pid(req));
      res.json(metrics);
    } catch (error) {
      console.error(error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to compute coordination metrics' });
    }
  },

  async getAIInsights(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId || !user.id)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const result = await teamService.getAIInsights(user.organizationId, pid(req), user.id);
      res.json(result);
    } catch (error) {
      console.error(error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to generate AI insights' });
    }
  },

  // ── Invites & Join Requests ───────────────────────────────────

  async getInvites(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const invites = await teamService.getInvites(user.organizationId, pid(req));
      res.json(invites);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch invites' });
    }
  },

  async inviteMember(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const { email, roleLabel, message } = req.body;
      if (!email) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Email is required' });
      const invite = await teamService.inviteMember(
        user.organizationId,
        pid(req),
        user.id,
        user.role,
        { email, roleLabel, message },
      );
      res.status(StatusCodes.CREATED).json(invite);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to send invite' });
    }
  },

  async requestToJoin(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const request = await teamService.requestToJoin(user.organizationId, pid(req), user.id);
      res.status(StatusCodes.CREATED).json(request);
    } catch (error) {
      console.error(error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to request to join team' });
    }
  },

  async acceptInvite(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const result = await teamService.respondToInvite(
        user.organizationId,
        pid(req),
        pinviteId(req),
        'accept',
        user.id,
        user.role,
      );
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: error.message || 'Failed to accept invite' });
    }
  },

  async declineInvite(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const result = await teamService.respondToInvite(
        user.organizationId,
        pid(req),
        pinviteId(req),
        'decline',
        user.id,
        user.role,
      );
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: error.message || 'Failed to decline invite' });
    }
  },

  // ── Chat ──────────────────────────────────────────────────────

  async getMessages(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const messages = await teamService.getMessages(user.organizationId, pid(req));
      res.json(messages);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch messages' });
    }
  },

  async sendMessage(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const message = await teamService.sendMessage(
        user.organizationId,
        pid(req),
        user.id,
        req.body.message,
      );
      res.status(StatusCodes.CREATED).json(message);
    } catch (error: any) {
      console.error(error);
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: error.message || 'Failed to send message' });
    }
  },

  // ── Tasks (Kanban) ────────────────────────────────────────────

  async getTeamTasks(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const tasks = await teamService.getTeamTasks(user.organizationId, pid(req));
      res.json(tasks);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch tasks' });
    }
  },

  async createTeamTask(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const task = await teamService.createTeamTask(
        user.organizationId,
        pid(req),
        user.id,
        req.body,
      );
      res.status(StatusCodes.CREATED).json(task);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create task' });
    }
  },

  async updateTeamTaskStatus(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const { status } = req.body;
      const task = await teamService.updateTeamTaskStatus(
        user.organizationId,
        pid(req),
        ptaskId(req),
        status,
        user.id,
      );
      res.json(task);
    } catch (error: any) {
      console.error(error);
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: error.message || 'Failed to update task' });
    }
  },

  // ── Projects ──────────────────────────────────────────────────

  async getTeamProjects(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const projects = await teamService.getTeamProjects(user.organizationId, pid(req));
      res.json(projects);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch projects' });
    }
  },

  async createTeamProject(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const project = await teamService.createTeamProject(
        user.organizationId,
        pid(req),
        user.id,
        req.body,
      );
      res.status(StatusCodes.CREATED).json(project);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create project' });
    }
  },

  // ── Activity ──────────────────────────────────────────────────

  async getTeamActivity(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const activity = await teamService.getTeamActivity(user.organizationId, pid(req));
      res.json(activity);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch activity' });
    }
  },

  // ── Progress ──────────────────────────────────────────────────

  async getTeamProgress(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const progress = await teamService.getTeamProgress(user.organizationId, pid(req));
      res.json(progress);
    } catch (error) {
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch progress' });
    }
  },

  // ── Candidate Search ──────────────────────────────────────────

  async searchCandidates(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const q = (req.query['q'] as string) || '';
      const candidates = await teamService.searchCandidates(user.organizationId, q, user.teamId);
      res.json(candidates);
    } catch (error) {
      console.error(error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to search candidates' });
    }
  },

  // ── Cross-Domain Collaboration ────────────────────────────────

  async getCollaborations(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const collabs = await teamService.getCollaborations(user.organizationId, pid(req));
      res.json(collabs);
    } catch (error) {
      console.error(error);
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to fetch collaborations' });
    }
  },

  async createCollaboration(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const { toTeamId, projectName, message } = req.body;
      if (!toTeamId)
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'toTeamId is required' });
      const collab = await teamService.createCollaboration(
        user.organizationId,
        pid(req),
        user.id,
        user.role,
        { toTeamId, projectName, message },
      );
      res.status(StatusCodes.CREATED).json(collab);
    } catch (error: any) {
      console.error(error);
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: error.message || 'Failed to create collaboration request' });
    }
  },

  async acceptCollaboration(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const result = await teamService.respondToCollaboration(
        user.organizationId,
        pcollabId(req),
        'accept',
        user.id,
        user.role,
      );
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: error.message || 'Failed to accept collaboration' });
    }
  },

  async declineCollaboration(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId)
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      const result = await teamService.respondToCollaboration(
        user.organizationId,
        pcollabId(req),
        'decline',
        user.id,
        user.role,
      );
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: error.message || 'Failed to decline collaboration' });
    }
  },
};
