import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';

// Read-only access to ProblemStatementProposal. This is also the polling
// surface for the detached analysis started by proposeProblemStatement, so a
// student who navigates away mid-analysis can come back and see the outcome.
//
// Numeric scoring (rubrics, perspectives, overallScore) is deliberately NOT
// returned to students — they see the outcome and the written reasoning only.
// Admins still get the full snapshot for auditing.

type ProposalRow = {
  id: string;
  verdict: string;
  reasons: string[];
  improvementHints: string[];
  extracted: unknown;
  rawText: string;
  publishedProjectId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** First meaningful line of the proposal, used until the AI extracts a title. */
function fallbackTitle(rawText: string): string {
  const firstLine = rawText
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .find((l) => l.length > 0);
  const source = firstLine || rawText.trim();
  return source.length > 80 ? `${source.slice(0, 80)}…` : source || 'Untitled proposal';
}

function proposalTitle(row: Pick<ProposalRow, 'extracted' | 'rawText'>): string {
  const extractedTitle = (row.extracted as { title?: string } | null)?.title;
  return extractedTitle?.trim() || fallbackTitle(row.rawText);
}

/**
 * Student-facing shape. `canClaim` is computed here rather than in the UI: an
 * accepted proposal publishes a catalog template with a single team slot, and
 * it stays claimable until the submitter actually claims it through the normal
 * catalog flow (which is what fills that slot).
 */
function toStudentDto(row: ProposalRow, claimedTemplateIds: Set<string>) {
  const claimed = Boolean(row.publishedProjectId && claimedTemplateIds.has(row.publishedProjectId));
  return {
    id: row.id,
    title: proposalTitle(row),
    status: row.verdict,
    reasons: row.reasons,
    improvementHints: row.improvementHints,
    publishedProjectId: row.publishedProjectId,
    claimed,
    canClaim: row.verdict === 'ACCEPTED' && Boolean(row.publishedProjectId) && !claimed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Which of these published templates already have a team claim on them. */
async function findClaimedTemplateIds(templateIds: string[]): Promise<Set<string>> {
  const ids = templateIds.filter(Boolean);
  if (ids.length === 0) return new Set();

  const claims = await prisma.project.findMany({
    where: { parentProjectId: { in: ids } },
    select: { parentProjectId: true },
  });

  return new Set(claims.map((c) => c.parentProjectId as string));
}

const PROPOSAL_SELECT = {
  id: true,
  verdict: true,
  reasons: true,
  improvementHints: true,
  extracted: true,
  rawText: true,
  publishedProjectId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const proposalReadController = {
  async getMyProposals(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const rows = await prisma.problemStatementProposal.findMany({
        where: { submitterId: user.id },
        orderBy: { createdAt: 'desc' },
        select: PROPOSAL_SELECT,
      });

      const claimedTemplateIds = await findClaimedTemplateIds(
        rows.map((r) => r.publishedProjectId).filter((id): id is string => Boolean(id)),
      );

      res.status(StatusCodes.OK).json({
        proposals: rows.map((r) => toStudentDto(r as ProposalRow, claimedTemplateIds)),
      });
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
      const proposal = await prisma.problemStatementProposal.findUnique({
        where: { id },
        select: { ...PROPOSAL_SELECT, submitterId: true, scores: true },
      });

      if (!proposal) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Proposal not found' });
      }

      const isAdmin = user.role === 'ADMIN';
      if (proposal.submitterId !== user.id && !isAdmin) {
        return res.status(StatusCodes.FORBIDDEN).json({ message: 'You do not have access to this proposal' });
      }

      const claimedTemplateIds = await findClaimedTemplateIds(
        proposal.publishedProjectId ? [proposal.publishedProjectId] : [],
      );

      res.status(StatusCodes.OK).json({
        proposal: {
          ...toStudentDto(proposal as ProposalRow, claimedTemplateIds),
          rawText: proposal.rawText,
          // Detailed AI scoring stays admin-only.
          ...(isAdmin ? { scores: proposal.scores } : {}),
        },
      });
    } catch (error) {
      console.error('Error fetching proposal:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },
};
