import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { prisma } from '../../shared/database';
import { chatJSON, ChatMessage } from '../ai/llm.service';
import { ProjectCategory } from '../../shared/projectLog.types';
import { wordOverlapRatio, jaccardSimilarity } from '../../shared/stringUtils';
import { MAX_TEAMS_PER_STATEMENT, APPROACH_OVERLAP_THRESHOLD, availability } from './selection.constants';
import { getTeamSelectionReadiness } from './selection.readiness';
import { computeFit, DOMAIN_REQUIRED_SKILLS } from '../metrics/selectionFit';
import { validateIdea, extractFeaturesForCombinedStatement, generatePhasePlan, MIN_PROPOSAL_LENGTH } from '../intelligence/ideaIntelligence.service';
import { IdeaValidation } from '../intelligence/ideaIntelligence.schemas';

// Full audit snapshot of why the AI scored/decided what it did — stored in
// ProblemStatementProposal.scores (Json). Previously only `rubrics` was kept,
// silently dropping the 5-perspective "strengths" scoring, hardware
// constraints, and duplicate detail after the one-shot API response.
function buildEvaluationSnapshot(evaluation: IdeaValidation) {
  return {
    overallScore: evaluation.overallScore,
    rubrics: evaluation.rubrics,
    perspectives: evaluation.perspectives,
    hardwareConstraints: evaluation.hardwareConstraints,
    duplicate: evaluation.duplicate,
  };
}

const ApproachCheckSchema = z.object({
  uniquenessScore: z.number().min(0).max(100),
  verdict: z.enum(['ACCEPT', 'REJECT']),
  overlapsWith: z.string().nullable().optional(),
  reason: z.string(),
  suggestions: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});

const VALID_CATEGORIES: ProjectCategory[] = ['MINI', 'FINAL_YEAR', 'RESEARCH'];
function coerceCategory(value: unknown): ProjectCategory | undefined {
  return VALID_CATEGORIES.includes(value as ProjectCategory) ? (value as ProjectCategory) : undefined;
}

// Checklist dimensions the mentor conversation is meant to cover before a
// team is considered "ready" to proceed to selection.
const CHECKLIST_DIMENSIONS = [
  { id: 'problemClarity', label: 'Problem understanding' },
  { id: 'targetUsers', label: 'Target users' },
  { id: 'uniqueValue', label: 'Unique value / differentiation' },
  { id: 'techStack', label: 'Tech stack' },
  { id: 'mvpScope', label: 'MVP scope' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'risks', label: 'Risks' },
  { id: 'successMetrics', label: 'Success metrics' },
] as const;

type ChecklistId = (typeof CHECKLIST_DIMENSIONS)[number]['id'];
type Checklist = Record<ChecklistId, boolean>;

const EMPTY_CHECKLIST: Checklist = CHECKLIST_DIMENSIONS.reduce(
  (acc, d) => ({ ...acc, [d.id]: false }),
  {} as Checklist,
);

type MentorChatResult = {
  reply: string;
  checklist: Checklist;
  readinessScore: number;
};

type MoscowList = { must: string[]; should: string[]; could: string[]; wont: string[] };

type ExtractedPlan = {
  problem: string;
  targetUsers: string;
  uniqueValue: string;
  techStack: string[];
  mvpFeatures: string[];
  moscow: MoscowList;
  risks: string[];
  successMetrics: string[];
  timelineWeeks: number;
};

type MentorReportResult = {
  ready: boolean;
  report: string;
  extracted: ExtractedPlan;
};

async function generateProblemId(prefix: 'H' | 'S' | 'HS') {
  const existing = await prisma.project.findMany({
    where: { problemId: { startsWith: prefix } },
    select: { problemId: true },
  });
  let max = 0;
  for (const e of existing) {
    const num = parseInt((e.problemId || '').replace(prefix, ''), 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function typeToPrefix(type: string): 'H' | 'S' | 'HS' {
  if (type === 'Hardware' || type === 'IoT') return 'H';
  if (type === 'Hardware & Software' || type === 'Hybrid' || type === 'Combination') return 'HS';
  return 'S';
}

export const catalogController = {
  async getReadiness(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }
      const readiness = await getTeamSelectionReadiness(user.id);
      res.json(readiness);
    } catch (error) {
      console.error('Error checking selection readiness:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  // The selection flow is stateless/client-driven (no server-side session store exists
  // for it), so per 00-OVERVIEW.md/PART-1 this endpoint just validates the category choice;
  // the client carries it forward and passes it again as a required field on
  // propose/select/finalize, which is where it actually lands on Project.category + the log.
  async startCatalogSession(req: Request, res: Response) {
    try {
      const category = coerceCategory(req.body?.category);
      if (!category) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid or missing category' });
      }
      res.json({ success: true, category, sessionId: `session_${Date.now()}` });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  // Get all catalog items with the number of times they've been selected.
  // Supports optional ?type=&domain=&sector=&sort=&minFit=&onlyOpen= filters for guided flow.
  async getCatalog(req: Request, res: Response) {
    try {
      const { type, domain, sector, sort, minFit, onlyOpen } = req.query as {
        type?: string;
        domain?: string;
        sector?: string;
        sort?: string;
        minFit?: string;
        onlyOpen?: string;
      };

      const user = (req as any).user;

      const templates = await prisma.project.findMany({
        where: {
          isTemplate: true,
          status: 'CATALOG',
          ...(type ? { type } : {}),
          ...(domain ? { domain } : {}),
          ...(sector ? { sector } : {}),
        },
        include: {
          childProjects: {
            select: {
              id: true,
              differentiationApproach: true,
              team: { select: { name: true } },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      let enriched: any[] = templates.map((t) => {
        const claims = t.childProjects.map((c) => ({
          teamName: c.team?.name || 'Team',
          approachSummary: c.differentiationApproach || 'Standard approach',
        }));
        return {
          ...t,
          claims,
          ...availability(t.childProjects.length, t.maxTeams),
        };
      });

      if (onlyOpen === 'true') {
        enriched = enriched.filter((t) => t.slotsLeft > 0);
      }

      if (user?.teamId) {
        const teamMembers = await prisma.user.findMany({
          where: { teamId: user.teamId },
          select: {
            id: true,
            userSkills: { select: { skillName: true } },
          },
        });
        const teamSkills = Array.from(
          new Set(teamMembers.flatMap((m) => m.userSkills.map((s) => s.skillName)))
        );

        enriched = enriched.map((t) => {
          const requiredSkills = DOMAIN_REQUIRED_SKILLS[t.domain || ''] || [];
          const fit = computeFit({
            teamSkills,
            requiredSkills,
            avgPerformance: 50,
            weeksAvailable: 12,
            difficultyTier: Number(t.difficultyLevel || 2),
          });
          return { ...t, fit };
        });

        if (minFit) {
          const threshold = Number(minFit);
          if (!isNaN(threshold)) {
            enriched = enriched.filter((t) => (t.fit?.score ?? 0) >= threshold);
          }
        }

        if (sort === 'fit') {
          enriched.sort((a, b) => (b.fit?.score ?? 0) - (a.fit?.score ?? 0));
        }
      }

      res.json(enriched);
    } catch (error) {
      console.error('Error fetching catalog:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  async getCatalogById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const template = await prisma.project.findUnique({
        where: { id },
        include: {
          childProjects: {
            select: {
              id: true,
              differentiationApproach: true,
              team: { select: { name: true } },
            },
          },
        },
      });

      if (!template || !template.isTemplate) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Catalog project not found' });
      }

      const childProjects = ((template as any).childProjects as any[]) || [];
      const claims = childProjects.map((c: any) => ({
        teamName: c.team?.name || 'Team',
        approachSummary: c.differentiationApproach || 'Standard approach',
      }));

      res.json({
        ...template,
        claims,
        ...availability(childProjects.length, template.maxTeams),
      });
    } catch (error) {
      console.error('Error fetching catalog project details:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  async checkApproachUniqueness(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { proposedApproach } = req.body as { proposedApproach: string };

      if (!proposedApproach || typeof proposedApproach !== 'string' || proposedApproach.trim().length < 30) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: 'Please provide a detailed differentiation approach (at least 30 characters).',
        });
      }

      const template = await prisma.project.findUnique({
        where: { id },
        include: {
          childProjects: {
            select: {
              id: true,
              differentiationApproach: true,
              team: { select: { name: true } },
            },
          },
        },
      });

      if (!template) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Project not found' });
      }

      const childProjects = ((template as any).childProjects as any[]) || [];
      const existingClaims = childProjects
        .map((c: any) => ({
          teamName: c.team?.name || 'Another Team',
          approach: c.differentiationApproach || '',
        }))
        .filter((c: any) => Boolean(c.approach));

      if (existingClaims.length === 0) {
        return res.json({
          uniquenessScore: 95,
          verdict: 'ACCEPT',
          overlapsWith: null,
          reason: 'You are the first team claiming this project statement! Your approach is unique.',
          suggestions: ['Ensure your architecture addresses system reliability and edge cases.'],
          keywords: proposedApproach.toLowerCase().split(/\s+/).slice(0, 5),
        });
      }

      // Jaccard, NOT wordOverlapRatio — wordOverlapRatio divides by the smaller
      // word set, so a long, detailed approach trivially "contains" every word
      // of a short one and scores as a near-duplicate. This same bug was fixed
      // for runProposalEvaluation above; the fallback here needs the same fix,
      // since it also backs the hard enforcement check in selectProject.
      let maxOverlap = 0;
      let mostSimilarTeam = '';
      for (const claim of existingClaims) {
        const ratio = jaccardSimilarity(proposedApproach, claim.approach);
        if (ratio > maxOverlap) {
          maxOverlap = ratio;
          mostSimilarTeam = claim.teamName;
        }
      }

      // uniquenessScore is derived from the SAME threshold selectProject enforces
      // (APPROACH_OVERLAP_THRESHOLD), so a heuristic ACCEPT here can never be
      // followed by a surprise 409 at claim time when the LLM is unavailable.
      const heuristicScore = Math.max(10, Math.min(100, Math.round((1 - maxOverlap) * 100)));
      const heuristicVerdict: 'ACCEPT' | 'REJECT' =
        maxOverlap <= APPROACH_OVERLAP_THRESHOLD ? 'ACCEPT' : 'REJECT';
      const heuristicFallback = {
        uniquenessScore: heuristicScore,
        verdict: heuristicVerdict,
        overlapsWith: maxOverlap > 0.25 ? mostSimilarTeam : null,
        reason:
          heuristicVerdict === 'ACCEPT'
            ? `Your approach shares only ${Math.round(maxOverlap * 100)}% vocabulary overlap with the ` +
              `nearest existing claim (${mostSimilarTeam || 'the other teams'}), which is well within the ` +
              `${Math.round(APPROACH_OVERLAP_THRESHOLD * 100)}% similarity limit — it reads as a distinct ` +
              'technical angle on this problem statement.'
            : `Your approach overlaps ${Math.round(maxOverlap * 100)}% with ${mostSimilarTeam}'s claim, ` +
              `above the ${Math.round(APPROACH_OVERLAP_THRESHOLD * 100)}% similarity limit allowed for this ` +
              'problem statement. Note: this is an automated fallback check (the AI evaluator was ' +
              'unavailable), so it only compares shared vocabulary, not underlying architecture.',
        suggestions:
          heuristicVerdict === 'REJECT'
            ? [
                'Swap the tech stack, algorithm, or core architecture pattern you plan to use.',
                'Target a different user group or use case within the same problem statement.',
                'Lead with a specific feature or constraint the other team\'s claim does not mention.',
              ]
            : [],
        keywords: proposedApproach.toLowerCase().split(/\s+/).slice(0, 5),
      };

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are an AI evaluator checking if a student team\'s proposed technical approach is ' +
            'meaningfully distinct from other teams already claiming the same problem statement, and ' +
            'you are writing your verdict directly for the student to read and act on.\n\n' +
            'Respond ONLY with a JSON object matching this schema: {"uniquenessScore": number (0-100), ' +
            '"verdict": "ACCEPT"|"REJECT", "overlapsWith": string|null, "reason": string, ' +
            '"suggestions": string[], "keywords": string[]}.\n\n' +
            'If uniquenessScore < 55, set verdict to REJECT.\n\n' +
            'WRITING THE "reason" FIELD — this is read by a student deciding whether to submit, so it ' +
            'must be clear enough to act on, not a one-line label:\n' +
            '- 3-5 sentences, plain language, no jargon left unexplained.\n' +
            '- Name the SPECIFIC overlapping elements if rejecting (e.g. "both use a Flutter app with ' +
            'BLE sensor polling and a shared Firebase backend"), not just "too similar".\n' +
            '- Name the SPECIFIC differentiating elements if accepting (e.g. "your use of solar-thermal ' +
            'storage instead of battery storage, and your focus on postnatal wards specifically, sets ' +
            'this apart").\n' +
            '- If overlapsWith is set, explain concretely what is shared with that team\'s approach.\n\n' +
            'WRITING "suggestions" (only when rejecting): give 2-3 concrete, specific pivots grounded in ' +
            'this exact problem statement and this exact overlap — not generic advice like "be more ' +
            'unique". Each suggestion should name an actual technology, user group, or feature the ' +
            'student could change to.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            problemStatement: template.problemStatement,
            existingApproaches: existingClaims,
            proposedApproach,
          }),
        },
      ];

      const result = await chatJSON(messages, heuristicFallback, {
        feature: 'checkApproachUniqueness',
        schema: ApproachCheckSchema,
        retries: 2,
        maxTokens: 900,
      });

      res.json(result);
    } catch (error) {
      console.error('Error checking approach uniqueness:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  // Aggregated { type -> domains -> subdomains } tree used to drive the
  // click-only category/domain/subdomain selection steps.
  async getCatalogTree(_req: Request, res: Response) {
    try {
      const rows = await prisma.project.findMany({
        where: { isTemplate: true, status: 'CATALOG' },
        select: { type: true, domain: true, sector: true },
      });

      const tree: Record<string, Record<string, Set<string>>> = {};

      for (const row of rows) {
        const type = row.type || 'Uncategorized';
        const domain = row.domain || 'Uncategorized';
        const sector = row.sector || 'General';

        if (!tree[type]) tree[type] = {};
        if (!tree[type][domain]) tree[type][domain] = new Set();
        tree[type][domain].add(sector);
      }

      const result = Object.entries(tree).map(([type, domains]) => ({
        type,
        domains: Object.entries(domains).map(([domain, sectors]) => ({
          domain,
          subdomains: Array.from(sectors).sort(),
        })),
      }));

      res.json({ tree: result });
    } catch (error) {
      console.error('Error fetching catalog tree:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },
  // Validate a student-proposed problem statement against the existing
  // catalog for that domain/subdomain before it's persisted.
  // Preview-only scoring for the proposal composer. Writes nothing — the
  // publish path (proposeProblemStatement) re-runs the same evaluation.
  async validateProposal(req: Request, res: Response) {
    try {
      const rawText = (req.body.rawText || req.body.proposedStatement || '') as string;

      if (!rawText || typeof rawText !== 'string' || rawText.trim().length < MIN_PROPOSAL_LENGTH) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: `Detailed proposal text of at least ${MIN_PROPOSAL_LENGTH} characters is required.`,
        });
      }

      const result = await validateIdea(rawText.trim());
      res.json(result);
    } catch (error) {
      console.error('Error validating proposal:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  async proposeProblemStatement(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const { rawText, statement } = req.body;
      const proposalText = (rawText || statement || '').trim();

      if (!proposalText || proposalText.length < MIN_PROPOSAL_LENGTH) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: `Detailed proposal text of at least ${MIN_PROPOSAL_LENGTH} characters is required.`,
        });
      }

      // Re-score server-side. The client's `evaluation` is a preview only and is
      // deliberately ignored — trusting it would let a submitter forge an
      // ACCEPTED verdict and publish arbitrary text into the shared catalog.
      const evaluation = await validateIdea(proposalText);

      if (evaluation.verdict !== 'ACCEPTED') {
        // Keep the rejection on record so repeat/duplicate submissions are auditable.
        await prisma.problemStatementProposal.create({
          data: {
            submitterId: user.id,
            rawText: proposalText,
            scores: buildEvaluationSnapshot(evaluation),
            verdict: evaluation.verdict,
            reasons: evaluation.reasons,
            improvementHints: evaluation.improvementHints,
            duplicateOfId: evaluation.duplicate?.similarProjectId || null,
            extracted: evaluation.extracted,
          },
        });

        return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          message:
            evaluation.verdict === 'REJECTED'
              ? 'This proposal did not meet the catalog acceptance criteria.'
              : 'This proposal needs improvement before it can be added to the catalog.',
          evaluation,
        });
      }

      const extracted = evaluation.extracted;

      const prefix = typeToPrefix(extracted.type || 'Software');
      const problemId = await generateProblemId(prefix);

      if (!user.organizationId) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'You must belong to an organization to propose a problem statement.' });
      }

      // Resolve the phase plan (an LLM/network call) before opening the
      // transaction below — awaiting an external HTTP call while holding a DB
      // transaction open risks exhausting the connection pool / hitting the
      // transaction timeout. `weeks` mirrors the `publishedProject.suggestedDurationWeeks
      // || 14` fallback that used to run post-creation: the create() below never
      // sets suggestedDurationWeeks, so that field is always null and the
      // fallback of 14 always applied anyway.
      const featureTotal = evaluation.features.reduce((sum, f) => sum + f.points, 0);
      const weeks = 14;
      const phasePlan = await generatePhasePlan({
        problemStatement: proposalText,
        projectType: extracted.type || 'Software',
        featureTotal,
        weeks,
      });

      // Publish the catalog entry and its audit row together so a failure can't
      // leave a template with no proposal record behind it.
      const { publishedProject, proposalRow } = await prisma.$transaction(async (tx) => {
      const publishedProject = await tx.project.create({
        data: {
          organizationId: user.organizationId as string,
          name: extracted.title || proposalText.slice(0, 50),
          shortName: extracted.title || proposalText.slice(0, 30),
          soul: extracted.soul || proposalText.slice(0, 120),
          problemStatement: proposalText,
          description: proposalText,
          domain: extracted.domain || 'Engineering',
          sector: extracted.sector || 'General',
          type: extracted.type || 'Software',
          difficultyLevel: String(extracted.difficultyLevel || '3'),
          technologies: extracted.technologies || [],
          deliverables: extracted.outcomes || [],
          outOfScope: extracted.outOfScope || null,
          skillsGained: extracted.skillsGained || [],
          prerequisites: extracted.prerequisites || [],
          problemId,
          status: 'CATALOG',
          isTemplate: true,
          maxTeams: 1, // Restricted to single team slot for proposed statements
        },
      });

      const proposalRow = await tx.problemStatementProposal.create({
        data: {
          submitterId: user.id,
          rawText: proposalText,
          scores: buildEvaluationSnapshot(evaluation),
          verdict: evaluation.verdict,
          reasons: evaluation.reasons,
          improvementHints: evaluation.improvementHints,
          duplicateOfId: evaluation.duplicate?.similarProjectId || null,
          extracted,
          publishedProjectId: publishedProject.id,
        },
      });

      if (evaluation.features.length > 0) {
        await tx.projectFeature.createMany({
          data: evaluation.features.map((f) => ({
            projectId: publishedProject.id,
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

      await tx.projectPhase.createMany({
        data: phasePlan.map((p) => ({
          projectId: publishedProject.id,
          phaseNumber: p.phaseNumber,
          title: p.title,
          expectedDeliverables: p.expectedDeliverables,
          weekTarget: p.weekTarget,
          points: p.points,
          hardwareNote: p.hardwareNote,
        })),
      });

        return { publishedProject, proposalRow };
      });

      res.status(StatusCodes.CREATED).json({
        success: true,
        proposalId: proposalRow.id,
        publishedProject,
      });
    } catch (error) {
      console.error('Error proposing problem statement:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  async selectProject(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      let teamId = user.teamId;
      if (!teamId) {
        if (!user.organizationId) {
          return res.status(StatusCodes.BAD_REQUEST).json({ message: 'User organization ID is required to create a team' });
        }
        const teamName = user.fullName ? `${user.fullName}'s Team` : 'Project Team';
        const newTeam = await prisma.team.create({
          data: {
            name: teamName,
            organizationId: user.organizationId,
            leadId: user.id,
            members: { connect: { id: user.id } },
            teamMembers: { create: { userId: user.id, roleLabel: 'Captain' } },
          },
        });
        teamId = newTeam.id;
        await prisma.user.update({
          where: { id: user.id },
          data: { teamId },
        });
        user.teamId = teamId;
      }

      const { id } = req.params;
      const { differentiationApproach, repoLink, category, teamMembers = [] } = req.body as {
        differentiationApproach?: string;
        repoLink?: string;
        category?: string;
        teamMembers?: string[];
      };

      if (!differentiationApproach || differentiationApproach.trim().length < 30) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: 'A unique differentiation approach (at least 30 characters) is required to claim a project.',
        });
      }

      const targetId = req.params.id as string;
      // Cheap existence check up front so we can 404 before opening a transaction.
      // The real overlap/capacity checks are re-run inside the transaction below —
      // this early read is advisory only and MUST NOT be trusted for the gate,
      // since a concurrent claim can land between this read and the transaction.
      const templateExists = await prisma.project.findUnique({
        where: { id: targetId },
        select: { id: true, isTemplate: true },
      });

      if (!templateExists || !templateExists.isTemplate) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Catalog project not found' });
      }

      const projectCategory = coerceCategory(category);

      // Capacity, overlap, and creation all happen inside one transaction, gated
      // by a Postgres advisory lock keyed on the template id. Without the lock,
      // two teams submitting within the same window both read the same
      // pre-claim snapshot, both pass the overlap/capacity check against it, and
      // both commit — landing two near-duplicate or over-capacity claims. The
      // lock forces concurrent claims against the same problem statement to
      // serialize, so the second team's transaction re-reads the FIRST team's
      // just-committed claim before deciding.
      const newProject = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${targetId}))`;

        const template = await tx.project.findUnique({
          where: { id: targetId },
          include: {
            _count: { select: { childProjects: true } },
            childProjects: {
              select: { differentiationApproach: true, team: { select: { name: true } } },
            },
          },
        });

        if (!template || !template.isTemplate) {
          throw new Error('Catalog project not found');
        }

        const count = (template as any)._count?.childProjects || 0;
        const maxCap = template.maxTeams ?? MAX_TEAMS_PER_STATEMENT;
        if (count >= maxCap) {
          throw new Error(`Maximum capacity (${maxCap} teams) reached for this project statement`);
        }

        // Same metric and threshold as checkApproachUniqueness's heuristic
        // fallback (APPROACH_OVERLAP_THRESHOLD) — a team told "unique" by the
        // preview can never be surprise-rejected here, and vice versa.
        for (const child of ((template as any).childProjects || [])) {
          if (child.differentiationApproach) {
            const overlap = jaccardSimilarity(differentiationApproach, child.differentiationApproach);
            if (overlap > APPROACH_OVERLAP_THRESHOLD) {
              throw new Error(
                `Your approach is too similar to an existing team claim (${child.team?.name || 'another team'}). Please provide a more distinct technical angle.`,
              );
            }
          }
        }

        const alreadySelected = await tx.project.findFirst({
          where: { parentProjectId: template.id, teamId },
        });

        if (alreadySelected) {
          throw new Error('Your team has already selected this project');
        }

        const created = await tx.project.create({
          data: {
            organizationId: template.organizationId,
            teamId,
            parentProjectId: template.id,
            name: template.name,
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
            differentiationApproach,
            differentiationKeywords: differentiationApproach.toLowerCase().split(/\s+/).slice(0, 8),
            repoLink: repoLink || undefined,
            category: projectCategory,
            status: 'pending_approval',
          },
        });

        const projectMembers = [
          { projectId: created.id, userId: user.id, role: 'ADMIN' as const },
          ...teamMembers.slice(0, 3).map((memberId: string) => ({
            projectId: created.id,
            userId: memberId,
            role: 'STUDENT' as const,
          })),
        ];

        await tx.projectMember.createMany({ data: projectMembers });

        // Same feature-extraction + phase-generation the propose-new-idea path
        // gets, run against the combined template statement + this team's
        // differentiation approach so a static catalog pick gets its own
        // reward-point scorecard instead of an empty execution template.
        const combinedText = `${template.problemStatement || ''}\n\nTeam's unique approach:\n${differentiationApproach}`;
        const { features } = await extractFeaturesForCombinedStatement(combinedText, template.type);

        if (features.length > 0) {
          await tx.projectFeature.createMany({
            data: features.map((f) => ({
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

        const featureTotal = features.reduce((sum, f) => sum + f.points, 0);
        const weeks = template.suggestedDurationWeeks || 14;
        const phasePlan = await generatePhasePlan({
          problemStatement: combinedText,
          projectType: template.type,
          featureTotal,
          weeks,
        });
        await tx.projectPhase.createMany({
          data: phasePlan.map((p) => ({
            projectId: created.id,
            phaseNumber: p.phaseNumber,
            title: p.title,
            expectedDeliverables: p.expectedDeliverables,
            weekTarget: p.weekTarget,
            points: p.points,
            hardwareNote: p.hardwareNote,
          })),
        });

        return created;
      });

      res.status(StatusCodes.CREATED).json(newProject);
    } catch (error: any) {
      console.error('Error selecting project:', error);
      const message = error.message || 'Internal server error';
      if (
        message.includes('Maximum capacity') ||
        message.includes('already selected') ||
        message.includes('too similar')
      ) {
        return res.status(StatusCodes.CONFLICT).json({ message });
      }
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message });
    }
  },

  // Post-selection mentor conversation: discusses implementation plan/niche,
  // then (mode="report") produces a readiness summary that unlocks selection.
  async mentor(req: Request, res: Response) {
    try {
      const { templateId, history = [], userMessage, mode, checklist: clientChecklist } = req.body as {
        templateId: string;
        history: ChatMessage[];
        userMessage?: string;
        mode: 'chat' | 'report';
        checklist?: Partial<Checklist>;
      };

      const template = await prisma.project.findUnique({ where: { id: templateId } });
      if (!template) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Problem statement not found' });
      }

      // Pull a couple of topically-related catalog entries in the same domain
      // so the mentor can challenge the team to explain how they differ.
      const siblingsInDomain = await prisma.project.findMany({
        where: {
          isTemplate: true,
          status: 'CATALOG',
          domain: template.domain,
          NOT: { id: template.id },
        },
        select: { shortName: true, name: true, problemStatement: true },
        take: 50,
      });
      const relatedWork = siblingsInDomain
        .map((s) => ({ ...s, score: wordOverlapRatio(s.problemStatement || '', template.problemStatement || '') }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => `- ${s.shortName || s.name}: ${s.problemStatement}`)
        .join('\n');

      const dimensionList = CHECKLIST_DIMENSIONS.map((d) => `"${d.id}" (${d.label})`).join(', ');

      const systemPrompt: ChatMessage = {
        role: 'system',
        content:
          `You are a warm, supportive project mentor having a real, free-flowing conversation with a ` +
          `student team about the following problem statement:\n\n"${template.problemStatement}"\n` +
          `(Domain: ${template.domain}, Subdomain: ${template.sector || 'N/A'}, ` +
          `Difficulty: ${template.difficultyLevel}, Type: ${template.type}).\n\n` +
          (relatedWork
            ? `Other related problem statements already in this domain, for context:\n${relatedWork}\n\n` +
              `IMPORTANT: Do NOT ask the differentiation question until the student has confirmed they ` +
              `understand their own problem statement first. Only then (once, naturally) ask how their ` +
              `approach will be different from these related statements.\n\n`
            : '') +
          `YOUR TONE — this applies to every single reply:\n` +
          `- Be the supportive senior colleague: patient, warm, never condescending.\n` +
          `- Use phrases like "Let me help you think through this", "That's a great question", ` +
          `"No worries — let's break this down together" rather than "You should know this".\n` +
          `- Celebrate small wins: "Great, that's a solid starting point!"\n\n` +
          `OPENING TURN (if conversation history is empty):\n` +
          `Start by warmly explaining the problem statement in plain, simple language — what it means, ` +
          `why it matters in the real world, and who it helps. Then ask: "Does this give you a clear ` +
          `picture of what we're building? Any questions before we dive in?" Do NOT immediately ask ` +
          `the student to walk you through their understanding or present a plan.\n\n` +
          `KNOWLEDGE-LEVEL DETECTION:\n` +
          `- Pay close attention to how the student responds. If they say "I don't know", "explain ` +
          `this to me", "you tell me", or give very short uncertain answers in 2+ consecutive turns, ` +
          `switch to TEACH-FIRST MODE: propose everything yourself (tech stack, target users, MVP ` +
          `features) and ask simple Yes/No/Tell-me-more reactions instead of open-ended questions.\n` +
          `- If the student demonstrates strong knowledge (detailed answers, specific technologies, ` +
          `clear reasoning), treat them as a peer and ask deeper technical questions.\n` +
          `- Adapt continuously — don't lock into one mode.\n\n` +
          `CONVERSATION RULES — read carefully, these take priority over everything else:\n` +
          `1. ALWAYS respond directly to what the student just said before doing anything else. If they ` +
          `ask a question (e.g. "explain this project", "what does X mean", "why is this hard"), answer ` +
          `it clearly and concretely using the problem statement, domain, and related work above — never ` +
          `dodge a question by asking an unrelated one back.\n` +
          `2. If the student asks you to decide, suggest, or lead ("you tell me", "you decide", "what do ` +
          `you think we should do", "just tell me the tech stack"), do NOT deflect the question back to ` +
          `them. Proactively propose 2-3 concrete, specific options grounded in this exact problem ` +
          `statement (e.g. a plausible tech stack, a candidate target user group, an MVP cut) and ask ` +
          `them to pick, react, or refine — give them something real to respond to, not another open ` +
          `question.\n` +
          `3. The student can ask clarifying questions or go off-script at ANY point, in any order — this ` +
          `is a discussion, not an interrogation or a fixed script. Only steer toward an uncovered ` +
          `checklist dimension once you've fully addressed what they actually said, and do it as a ` +
          `natural continuation of the conversation, not a rigid checklist march.\n` +
          `4. PROGRESSIVE DISCLOSURE — cover checklist dimensions in this order, not randomly:\n` +
          `   Stage 1 (Foundation): problemClarity, targetUsers, uniqueValue — cover these FIRST.\n` +
          `   Stage 2 (Technical): techStack, mvpScope — only after Stage 1 is solid.\n` +
          `   Stage 3 (Planning): timeline, risks, successMetrics — only after Stages 1 & 2.\n` +
          `   Never ask about risks or success metrics before the student understands the problem.\n` +
          `5. If the team's scope looks too large for their stated timeline, push back and suggest ` +
          `cutting to an MVP.\n` +
          `6. Keep replies short and concrete (2-5 sentences) — real mentor talk, not a lecture.\n` +
          `7. VALIDATION BEFORE PROGRESSION: If the student states they "don't know" or asks for an ` +
          `explanation, explain the concept simply and then STOP. Explicitly validate their understanding ` +
          `(e.g., "Does that make sense?" or "Are we on the same page?") before pivoting to the next ` +
          `checklist topic or demanding architectural decisions. DO NOT blindly ask them for a plan if ` +
          `they just told you they don't know.\n\n` +
          `Respond ONLY with a JSON object: {"reply": string, "checklist": {${CHECKLIST_DIMENSIONS.map((d) => `"${d.id}": boolean`).join(', ')}}, "readinessScore": number}. ` +
          `CHECKLIST CALIBRATION: Only mark a dimension as true if the student has demonstrated genuine ` +
          `understanding or made a specific, informed decision — NOT merely if they said "ok" or "yes" ` +
          `to your suggestion without elaborating. A passive "ok" does not count as coverage. ` +
          `readinessScore is 0-100, how ready the team is to move to a readiness report. Dimensions: ${dimensionList}.`,
      };


      if (mode === 'report') {
        const fallbackExtracted: ExtractedPlan = {
          problem: template.problemStatement || '',
          targetUsers: '',
          uniqueValue: '',
          techStack: [],
          mvpFeatures: [],
          moscow: { must: [], should: [], could: [], wont: [] },
          risks: [],
          successMetrics: [],
          timelineWeeks: 0,
        };
        const fallback: MentorReportResult = {
          ready: true,
          report:
            `Problem statement: ${template.shortName || template.name}.\n` +
            `Domain: ${template.domain} / ${template.sector || 'N/A'}. Difficulty: ` +
            `${template.difficultyLevel}.\nBased on the discussion, the team has outlined an ` +
            `implementation approach and a plan to ensure quality and originality. Ready to ` +
            `proceed with team setup.`,
          extracted: fallbackExtracted,
        };

        const reportMessages: ChatMessage[] = [
          systemPrompt,
          ...history,
          {
            role: 'user',
            content:
              'Summarize this conversation into a readiness report and a structured extraction. ' +
              'Respond ONLY with a JSON object matching this shape: {"ready": boolean, "report": ' +
              'string, "extracted": {"problem": string, "targetUsers": string, "uniqueValue": ' +
              'string, "techStack": string[], "mvpFeatures": string[], "moscow": {"must": string[], ' +
              '"should": string[], "could": string[], "wont": string[]}, "risks": string[], ' +
              '"successMetrics": string[], "timelineWeeks": number}}. "report" is plain text ' +
              'covering the problem statement, difficulty, implementation plan, and quality/' +
              'originality angle, ending with a clear readiness statement. "moscow" is a ' +
              "Must/Should/Could/Won't-have scope cut sized to fit within timelineWeeks — cut " +
              'anything unrealistic for that timeframe into "should" or "could" rather than "must".',
          },
        ];

        const result = await chatJSON<MentorReportResult>(reportMessages, fallback);
        return res.json(result);
      }

      const fallbackChecklist: Checklist = { ...EMPTY_CHECKLIST, ...(clientChecklist || {}) };
      const fallbackResult: MentorChatResult = {
        reply:
          "Let me help you think through this step by step. First — do you have a general idea " +
          "of what this problem statement is about, or would you like me to explain it in simple terms?",
        checklist: fallbackChecklist,
        readinessScore: 0,
      };

      const chatMessages: ChatMessage[] = [
        systemPrompt,
        ...history,
        ...(userMessage ? [{ role: 'user', content: userMessage } as ChatMessage] : []),
      ];

      const result = await chatJSON<MentorChatResult>(chatMessages, fallbackResult);
      res.json(result);
    } catch (error) {
      console.error('Error in mentor chat:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  // Given a candidate team roster and the extracted plan from the mentor
  // report, suggest a role + task allocation per member based on their
  // recorded skills (UserSkill), so the team can sanity-check coverage
  // before finalizing selection.
  async allocateTeam(req: Request, res: Response) {
    try {
      const user = req.user;
      const { templateId, teamMemberIds = [], extracted } = req.body as {
        templateId: string;
        teamMemberIds: string[];
        extracted: ExtractedPlan;
      };

      if (!templateId || !extracted) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
      }

      const template = await prisma.project.findUnique({ where: { id: templateId } });
      if (!template) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Problem statement not found' });
      }

      const memberIds = Array.from(new Set([user?.id, ...teamMemberIds].filter(Boolean))) as string[];
      const members = await prisma.user.findMany({
        where: { id: { in: memberIds } },
        select: {
          id: true,
          fullName: true,
          userSkills: { select: { skillName: true, skillType: true, totalPoints: true } },
        },
      });

      const fallbackAllocations = members.map((m) => ({
        userId: m.id,
        name: m.fullName,
        matchedSkills: m.userSkills.slice(0, 3).map((s) => s.skillName),
        suggestedRole: m.id === user?.id ? 'Team Lead' : 'Contributor',
        suggestedTasks: [] as string[],
      }));
      const fallback = { allocations: fallbackAllocations };

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are allocating work across a student project team based on each member\'s ' +
            'recorded skills and the project\'s required tech stack and MVP features. Respond ' +
            'ONLY with a JSON object: {"allocations": [{"userId": string, "suggestedRole": ' +
            'string, "matchedSkills": string[], "suggestedTasks": string[]}]}. One entry per ' +
            'member id given. matchedSkills must be drawn from that member\'s given skills only. ' +
            'suggestedTasks should be 2-3 concrete tasks from the MVP features/tech stack that ' +
            "fit that member's skills. If a required skill has no strong match on the team, " +
            'still assign it to the closest member and note the gap by prefixing that task with ' +
            '"(stretch) ".',
        },
        {
          role: 'user',
          content: JSON.stringify({
            problem: extracted.problem,
            techStack: extracted.techStack,
            mvpFeatures: extracted.mvpFeatures,
            members: members.map((m) => ({
              userId: m.id,
              name: m.fullName,
              skills: m.userSkills.map((s) => ({ name: s.skillName, type: s.skillType, points: s.totalPoints })),
            })),
          }),
        },
      ];

      const result = await chatJSON<{ allocations: typeof fallbackAllocations }>(messages, fallback);
      const nameById = new Map(members.map((m) => [m.id, m.fullName]));
      const allocations = result.allocations.map((a) => ({ ...a, name: nameById.get(a.userId) || a.name }));

      res.json({ allocations });
    } catch (error) {
      console.error('Error allocating team:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

};
