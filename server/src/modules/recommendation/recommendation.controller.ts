import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../../middleware/authGuard';
import { prisma } from '../../shared/database';
import { isLlmConfigured } from '../ai/llm.service';
import { OpportunityService } from './opportunity.service';

export const recommendationController = {
  /**
   * GET /api/admin/recommendations
   * List all OpportunityRecommendation records with optional filters.
   * Query params: status (OPEN | ACKNOWLEDGED | DISMISSED | ALL), type (HACKATHON | PRESENTATION | INCUBATION), page, pageSize
   */
  getRecommendations: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = req.query.status ? String(req.query.status) : undefined;
      const page = Math.max(1, parseInt(String(req.query.page || '1')));
      const pageSize = Math.max(1, Math.min(100, parseInt(String(req.query.pageSize || '20'))));

      const where: any = {};

      if (status && status !== 'ALL') {
        where.status = status;
      } else if (!status) {
        // Default: show OPEN items
        where.status = 'OPEN';
      }

      // Optional filter by opportunity type present in recommendations JSON
      // Prisma doesn't support JSON array element filtering natively in all adapters,
      // so we filter by type post-query when requested.
      const typeFilter = req.query.type ? String(req.query.type) : undefined;

      const skip = (page - 1) * pageSize;

      const [records, total, openCount] = await Promise.all([
        prisma.opportunityRecommendation.findMany({
          where,
          include: {
            project: {
              select: {
                id: true,
                name: true,
                domain: true,
                technologies: true,
                team: { select: { id: true, name: true, domain: true } },
              },
            },
            reviewedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: [{ opportunityScore: 'desc' }, { createdAt: 'desc' }],
          skip,
          take: pageSize,
        }),
        prisma.opportunityRecommendation.count({ where }),
        prisma.opportunityRecommendation.count({ where: { status: 'OPEN' } }),
      ]);

      // Apply post-query type filter
      const filtered = typeFilter
        ? records.filter((r) => {
            const recs = r.recommendations as any[];
            return Array.isArray(recs) && recs.some((rec) => rec.type === typeFilter);
          })
        : records;

      res.json({ recommendations: filtered, total, openCount, page, pageSize });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  /**
   * GET /api/admin/recommendations/:id
   * Full detail view of a single OpportunityRecommendation.
   */
  getRecommendationById: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const record = await prisma.opportunityRecommendation.findUnique({
        where: { id: req.params.id as string },
        include: {
          project: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  members: { select: { id: true, fullName: true, regNo: true } },
                },
              },
              evaluationReports: {
                orderBy: { cycle: 'asc' },
                select: { cycle: true, content: true },
              },
              githubRepo: {
                select: { commitCount: true, contributorCount: true },
              },
            },
          },
          reviewedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      if (!record) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Opportunity recommendation not found' });
        return;
      }

      res.json(record);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  /**
   * PATCH /api/admin/recommendations/:id
   * Admin review action: update status and/or reviewNote.
   * Body: { status: 'ACKNOWLEDGED' | 'DISMISSED' | 'OPEN', reviewNote?: string }
   */
  updateRecommendationStatus: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, reviewNote } = req.body;

      if (!['OPEN', 'ACKNOWLEDGED', 'DISMISSED'].includes(status)) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "Invalid status. Must be 'OPEN', 'ACKNOWLEDGED', or 'DISMISSED'." });
        return;
      }

      // Verify the record exists before updating
      const existing = await prisma.opportunityRecommendation.findUnique({
        where: { id: req.params.id as string },
        select: { id: true },
      });

      if (!existing) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Opportunity recommendation not found' });
        return;
      }

      const updated = await prisma.opportunityRecommendation.update({
        where: { id: req.params.id as string },
        data: {
          status,
          reviewNote: reviewNote ?? null,
          reviewedById: req.user?.id ?? null,
        },
      });

      res.json(updated);
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  /**
   * POST /api/admin/recommendations/recompute
   * Manually trigger the opportunity matching pipeline.
   * Runs synchronously so the caller gets back the run stats.
   */
  recomputeRecommendations: async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await OpportunityService.runOpportunityMatching();
      res.json({ message: 'Opportunity matching pipeline completed', stats });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },

  /**
   * GET /api/admin/recommendations/status
   * Summary counts + LLM configuration status.
   */
  getRecommendationsStatus: async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const [openCount, acknowledgedCount, dismissedCount, totalCount] = await Promise.all([
        prisma.opportunityRecommendation.count({ where: { status: 'OPEN' } }),
        prisma.opportunityRecommendation.count({ where: { status: 'ACKNOWLEDGED' } }),
        prisma.opportunityRecommendation.count({ where: { status: 'DISMISSED' } }),
        prisma.opportunityRecommendation.count(),
      ]);

      res.json({
        llmConfigured: isLlmConfigured(),
        counts: {
          open: openCount,
          acknowledged: acknowledgedCount,
          dismissed: dismissedCount,
          total: totalCount,
        },
      });
    } catch (err: any) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message });
    }
  },
};
