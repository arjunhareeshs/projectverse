import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../../middleware/authGuard';
import { prisma } from '../../shared/database';
import { isLlmConfigured } from '../ai/llm.service';
import { TopPerformersService } from './topPerformers.service';
import { runInsightsPipeline, getInsightsStatus } from './insights.scheduler';

export const insightsController = {
  // Top Teams
  getTopTeams: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = Math.max(1, parseInt(String(req.query.limit || '5')));
      const groups = await TopPerformersService.getTopTeamsByDomain(limit);
      res.json(groups);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // Top Students
  getTopStudents: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = Math.max(1, parseInt(String(req.query.limit || '5')));
      const groups = await TopPerformersService.getTopStudentsByDomain(limit);
      res.json(groups);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // Overlaps List
  getOverlaps: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = req.query.status ? String(req.query.status) : undefined;
      const domain = req.query.domain ? String(req.query.domain) : undefined;
      const page = Math.max(1, parseInt(String(req.query.page || '1')));
      const pageSize = Math.max(1, parseInt(String(req.query.pageSize || '20')));

      const where: any = {};
      if (status && status !== 'ALL') {
        where.status = status;
      } else if (!status) {
        where.status = 'OPEN';
      }
      if (domain) {
        where.domain = { contains: domain, mode: 'insensitive' };
      }

      const skip = (page - 1) * pageSize;

      const [flags, total, openCount] = await Promise.all([
        prisma.projectOverlapFlag.findMany({
          where,
          include: {
            members: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    domain: true,
                    team: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
          orderBy: [
            { severity: 'desc' },
            { similarityScore: 'desc' },
          ],
          skip,
          take: pageSize,
        }),
        prisma.projectOverlapFlag.count({ where }),
        prisma.projectOverlapFlag.count({ where: { status: 'OPEN' } }),
      ]);

      res.json({ flags, total, openCount, page, pageSize });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // Get Overlap by ID
  getOverlapById: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const flag = await prisma.projectOverlapFlag.findUnique({
        where: { id: req.params.id as string },
        include: {
          members: {
            include: {
              project: {
                include: {
                  team: { select: { id: true, name: true, members: { select: { id: true, fullName: true, regNo: true } } } },
                },
              },
            },
          },
        },
      });

      if (!flag) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Overlap flag not found' });
        return;
      }

      res.json(flag);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // Patch Overlap Status
  updateOverlapStatus: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, reviewNote } = req.body;
      if (!['OPEN', 'ACKNOWLEDGED', 'DISMISSED', 'SUPPRESSED'].includes(status)) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid status' });
        return;
      }

      const updated = await prisma.projectOverlapFlag.update({
        where: { id: req.params.id as string },
        data: {
          status,
          reviewNote: reviewNote || null,
          reviewedById: req.user?.id || null,
        },
      });

      res.json(updated);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // Standouts List
  getStandouts: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = req.query.status ? String(req.query.status) : undefined;
      const verdict = req.query.verdict ? String(req.query.verdict) : undefined;
      const page = Math.max(1, parseInt(String(req.query.page || '1')));
      const pageSize = Math.max(1, parseInt(String(req.query.pageSize || '20')));

      const where: any = {};
      if (status && status !== 'ALL') {
        where.status = status;
      } else if (!status) {
        where.status = 'OPEN';
      }
      if (verdict) {
        where.verdict = verdict;
      }

      const skip = (page - 1) * pageSize;

      const [standouts, total] = await Promise.all([
        prisma.standoutProject.findMany({
          where,
          include: {
            project: {
              include: {
                team: { select: { id: true, name: true, domain: true } },
                evaluationReports: {
                  select: { cycle: true, content: true },
                  orderBy: { cycle: 'asc' },
                },
              },
            },
          },
          orderBy: [
            { verdict: 'asc' }, // STARTUP_WORTHY before PROMISING
            { evidenceScore: 'desc' },
          ],
          skip,
          take: pageSize,
        }),
        prisma.standoutProject.count({ where }),
      ]);

      res.json({ standouts, total, page, pageSize });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // Get Standout by ID
  getStandoutById: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const standout = await prisma.standoutProject.findUnique({
        where: { id: req.params.id as string },
        include: {
          project: {
            include: {
              team: { select: { id: true, name: true, members: { select: { id: true, fullName: true, regNo: true } } } },
              evaluationReports: { orderBy: { cycle: 'asc' } },
              githubRepo: true,
            },
          },
        },
      });

      if (!standout) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Standout project not found' });
        return;
      }

      res.json(standout);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // Patch Standout Status
  updateStandoutStatus: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, reviewNote } = req.body;
      if (!['OPEN', 'ACKNOWLEDGED', 'DISMISSED'].includes(status)) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid status' });
        return;
      }

      const updated = await prisma.standoutProject.update({
        where: { id: req.params.id as string },
        data: {
          status,
          reviewNote: reviewNote || null,
          reviewedById: req.user?.id || null,
        },
      });

      res.json(updated);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // Recompute Insights
  recomputeInsights: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const scope = req.body?.scope || 'all';
      const result = await runInsightsPipeline(scope);
      res.json({ message: 'Insights recomputation started/completed', result });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  // Status
  getInsightsStatus: async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const status = getInsightsStatus();
      const [openOverlapsCount, totalStandoutsCount] = await Promise.all([
        prisma.projectOverlapFlag.count({ where: { status: 'OPEN' } }),
        prisma.standoutProject.count({ where: { status: 'OPEN' } }),
      ]);

      res.json({
        ...status,
        llmConfigured: isLlmConfigured(),
        counts: {
          openOverlaps: openOverlapsCount,
          openStandouts: totalStandoutsCount,
        },
      });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },
};
