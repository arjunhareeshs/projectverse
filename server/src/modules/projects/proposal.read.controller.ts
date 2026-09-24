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

  async claimSelfProposal(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const id = req.params.id as string;
      const proposal = await prisma.problemStatementProposal.findUnique({
        where: { id },
      });

      if (!proposal) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Proposal not found' });
      }

      if (proposal.verdict !== 'ACCEPTED' || !proposal.publishedProjectId) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Proposal is not in an accepted claimable state' });
      }

      const template = await prisma.project.findUnique({
        where: { id: proposal.publishedProjectId },
        include: {
          deliverablesList: true,
          features: true,
        },
      });

      if (!template) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Published project template not found' });
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          team: {
            include: {
              members: true,
            },
          },
        },
      });

      if (!currentUser) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'User not found' });
      }

      const isSubmitter = proposal.submitterId === user.id;
      const submitter = await prisma.user.findUnique({
        where: { id: proposal.submitterId },
        select: { teamId: true },
      });
      const isSameTeam = currentUser.teamId && submitter?.teamId === currentUser.teamId;
      const isAdmin = user.role === 'ADMIN';

      if (!isSubmitter && !isSameTeam && !isAdmin) {
        return res.status(StatusCodes.FORBIDDEN).json({
          message: 'Only the proposal creator or their team can claim this project',
        });
      }

      if (!currentUser.teamId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: 'You must belong to a team before claiming a project. Please create or join a team first.',
        });
      }

      const teamId = currentUser.teamId;

      // Check if already claimed
      const existingClaim = await prisma.project.findFirst({
        where: {
          parentProjectId: template.id,
        },
      });

      if (existingClaim) {
        if (existingClaim.teamId === teamId) {
          return res.status(StatusCodes.OK).json({
            success: true,
            projectId: existingClaim.id,
            message: 'Project already claimed by your team',
          });
        }
        return res.status(StatusCodes.CONFLICT).json({ message: 'This proposed project has already been claimed' });
      }

      const teamMemberIds = (currentUser.team?.members || []).map((m) => m.id);

      const newProject = await prisma.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: {
            organizationId: template.organizationId,
            teamId,
            parentProjectId: template.id,
            name: template.name,
            shortName: template.shortName,
            soul: template.soul,
            description: template.description,
            domain: template.domain,
            sector: template.sector,
            difficultyLevel: template.difficultyLevel,
            type: template.type,
            problemStatement: template.problemStatement,
            backgroundContext: template.backgroundContext,
            targetUsers: template.targetUsers,
            expectedOutcome: template.expectedOutcome,
            technologies: template.technologies,
            requirements: template.requirements,
            deliverables: template.deliverables ?? undefined,
            differentiationApproach: proposal.rawText,
            differentiationKeywords: (template.name || '').toLowerCase().split(/\s+/).slice(0, 8),
            category: 'MINI',
            status: 'in_progress',
          },
        });

        const projectMembers = [
          { projectId: created.id, userId: user.id, role: 'ADMIN' as const },
          ...teamMemberIds
            .filter((memberId) => memberId !== user.id)
            .slice(0, 3)
            .map((memberId) => ({
              projectId: created.id,
              userId: memberId,
              role: 'STUDENT' as const,
            })),
        ];
        await tx.projectMember.createMany({ data: projectMembers });

        if (template.deliverablesList && template.deliverablesList.length > 0) {
          await tx.projectDeliverable.createMany({
            data: template.deliverablesList.map((d: any) => ({
              projectId: created.id,
              text: d.text,
              order: d.order,
            })),
          });
        }

        if (template.features && template.features.length > 0) {
          await tx.projectFeature.createMany({
            data: template.features.map((f: any) => ({
              projectId: created.id,
              name: f.name,
              description: f.description,
              importance: f.importance,
              implementationMethod: f.implementationMethod,
              points: f.points,
              aiRationale: f.aiRationale,
              addedBy: 'AI',
            })),
          });
        }

        return created;
      });

      res.status(StatusCodes.CREATED).json({
        success: true,
        projectId: newProject.id,
        message: 'Self-proposed project claimed successfully',
      });
    } catch (error: any) {
      console.error('Error claiming self proposal:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: error?.message || 'Failed to claim self proposal',
      });
    }
  },
};
