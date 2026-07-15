import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';
import { notificationService } from '../notifications/notification.service';
import { taskService } from '../tasks/task.service';
import type { InternalRequest } from '../../middleware/internalAuth';

export const internalController = {
  // GET /api/internal/browser-token
  // Returns a short-lived JWT (5-min) for the AI service's headed Playwright browser
  // to authenticate as the requesting user on the frontend.
  async getBrowserToken(req: InternalRequest, res: Response) {
    try {
      const userId = req.internalUser?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ error: 'no_identity' });
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, organizationId: true },
      });
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({ error: 'user_not_found' });
      }
      const secret = process.env['JWT_ACCESS_SECRET'];
      if (!secret) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'jwt_not_configured' });
      }
      const token = jwt.sign(
        { sub: user.id, role: user.role, orgId: user.organizationId },
        secret,
        { expiresIn: '5m' },
      );
      return res.json({ token });
    } catch (error) {
      console.error('[Internal] getBrowserToken error:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'server_error', detail: String(error) });
    }
  },

  // GET /api/internal/teams/:id/members
  async getTeamMembers(req: InternalRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const team = await prisma.team.findUnique({
        where: { id },
        include: {
          teamMembers: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  department: true,
                  ssgDomain: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (!team) {
        return res.status(StatusCodes.NOT_FOUND).json({ error: 'team_not_found', detail: 'Team not found' });
      }

      return res.json({
        id: team.id,
        name: team.name,
        description: team.description,
        domain: team.domain,
        members: team.teamMembers.map((tm) => ({
          id: tm.user.id,
          fullName: tm.user.fullName,
          email: tm.user.email,
          department: tm.user.department,
          ssgDomain: tm.user.ssgDomain,
          teamRole: tm.roleLabel,
          userSkills: [],
        })),
      });
    } catch (error) {
      console.error('[Internal] Error fetching team members:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'server_error', detail: String(error) });
    }
  },

  // POST /api/internal/teams/:id/messages
  async postTeamMessage(req: InternalRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as { message?: string; body?: string };
      const message = body.message || body.body || '';
      const senderId = req.internalUser?.userId;

      if (!message) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'missing_message', detail: 'Message body is required' });
      }

      const result = await prisma.teamMessage.create({
        data: {
          teamId: id,
          userId: senderId || 'system',
          message: message,
        },
        include: {
          user: { select: { id: true, fullName: true } },
        },
      });

      return res.status(StatusCodes.CREATED).json({
        id: result.id,
        teamId: result.teamId,
        message: result.message,
        sender: result.user?.fullName || 'AI Agent',
        createdAt: result.createdAt,
      });
    } catch (error) {
      console.error('[Internal] Error posting team message:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'server_error', detail: String(error) });
    }
  },

  // POST /api/internal/notifications
  async createNotification(req: InternalRequest, res: Response) {
    try {
      const { userId, title, body } = req.body as { userId: string; title: string; body: string };
      if (!userId || !title || !body) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'missing_fields', detail: 'userId, title, and body are required' });
      }
      const notification = await notificationService.createForUser(userId, title, body);
      return res.status(StatusCodes.CREATED).json(notification);
    } catch (error) {
      console.error('[Internal] Error creating notification:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'server_error', detail: String(error) });
    }
  },

  // POST /api/internal/notifications/broadcast
  async broadcastNotification(req: InternalRequest, res: Response) {
    try {
      const { teamId, title, body } = req.body as { teamId: string; title: string; body: string };
      if (!teamId || !title || !body) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'missing_fields', detail: 'teamId, title, and body are required' });
      }
      const result = await notificationService.broadcastToTeam(teamId, title, body);
      return res.status(StatusCodes.CREATED).json(result);
    } catch (error) {
      console.error('[Internal] Error broadcasting notification:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'server_error', detail: String(error) });
    }
  },

  // GET /api/internal/tasks
  async getTasks(req: Request, res: Response) {
    try {
      const { projectId, assigneeId, status } = req.query as {
        projectId?: string;
        assigneeId?: string;
        status?: string;
      };

      const where: any = {};
      if (projectId) where.projectId = projectId;
      if (assigneeId) where.assigneeId = assigneeId;
      if (status) where.status = status;

      const tasks = await prisma.task.findMany({
        where,
        include: {
          assignee: { select: { id: true, fullName: true, email: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return res.json({ tasks });
    } catch (error) {
      console.error('[Internal] Error fetching tasks:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'server_error', detail: String(error) });
    }
  },

  // POST /api/internal/tasks
  async createTask(req: Request, res: Response) {
    try {
      const data = req.body as {
        projectId: string;
        title: string;
        description?: string;
        assigneeId?: string;
        priority?: string;
        dueDate?: string;
      };

      if (!data.projectId || !data.title) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'missing_fields', detail: 'projectId and title are required' });
      }

      const task = await taskService.createTask({
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        priority: data.priority,
        dueDate: data.dueDate,
      });

      return res.status(StatusCodes.CREATED).json(task);
    } catch (error) {
      console.error('[Internal] Error creating task:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'server_error', detail: String(error) });
    }
  },

  // PATCH /api/internal/tasks/:id
  async updateTask(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const data = req.body as { status?: string; assigneeId?: string; title?: string; priority?: string; dueDate?: string };

      const updateData: any = {};
      if (data.status) updateData.status = data.status;
      if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId || null;
      if (data.title) updateData.title = data.title;
      if (data.priority) updateData.priority = data.priority;
      if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
      if (data.status === 'done' || data.status === 'completed') {
        updateData.completedAt = new Date();
      }

      const task = await prisma.task.update({
        where: { id },
        data: updateData,
        include: { assignee: { select: { id: true, fullName: true, email: true } } },
      });

      return res.json(task);
    } catch (error) {
      console.error('[Internal] Error updating task:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'server_error', detail: String(error) });
    }
  },

  // GET /api/internal/projects
  async getProjects(req: InternalRequest, res: Response) {
    try {
      const orgId = req.internalUser?.orgId;
      if (!orgId) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'missing_org_id', detail: 'No organization ID found on internal user context.' });
      }

      const projects = await prisma.project.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      });

      return res.json({ projects });
    } catch (error) {
      console.error('[Internal] Error fetching projects:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'server_error', detail: String(error) });
    }
  },

  // GET /api/internal/teams
  async getTeams(req: InternalRequest, res: Response) {
    try {
      const orgId = req.internalUser?.orgId;
      if (!orgId) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: 'missing_org_id', detail: 'No organization ID found on internal user context.' });
      }

      const teams = await prisma.team.findMany({
        where: { organizationId: orgId },
        include: {
          teamMembers: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  ssgDomain: true,
                  department: true,
                }
              }
            }
          }
        },
        orderBy: { name: 'asc' },
      });

      return res.json({
        teams: teams.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          domain: t.domain,
          members: t.teamMembers.map(tm => ({
            id: tm.user.id,
            fullName: tm.user.fullName,
            email: tm.user.email,
            ssgDomain: tm.user.ssgDomain,
            department: tm.user.department,
            teamRole: tm.roleLabel,
          }))
        }))
      });
    } catch (error) {
      console.error('[Internal] Error fetching teams list:', error);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'server_error', detail: String(error) });
    }
  },
};
