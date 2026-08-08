import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';

// Read-only access to ProblemStatementProposal — the persisted AI evaluation
// snapshot (rubrics, perspectives/"strengths", hardware constraints, duplicate
// detail, extracted metadata, reasons) written by proposeProblemStatement.
// This is what makes a proposal's reasoning inspectable after the fact instead
// of only existing for the lifetime of the original API response.
export const proposalReadController = {
  async getMyProposals(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const proposals = await prisma.problemStatementProposal.findMany({
        where: { submitterId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          verdict: true,
          reasons: true,
          scores: true,
          publishedProjectId: true,
          duplicateOfId: true,
          createdAt: true,
        },
      });

      res.status(StatusCodes.OK).json({ proposals });
    } catch (error) {
      console.error('Error fetching proposals:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  async getProposalById(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const id = req.params.id as string;
      const proposal = await prisma.problemStatementProposal.findUnique({ where: { id } });

      if (!proposal) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Proposal not found' });
      }

      if (proposal.submitterId !== user.id && user.role !== 'ADMIN') {
        return res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have access to this proposal' });
      }

      res.status(StatusCodes.OK).json({ proposal });
    } catch (error) {
      console.error('Error fetching proposal:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },
};
