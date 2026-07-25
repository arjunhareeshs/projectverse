import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';
import { chat, chatJSON, ChatMessage } from '../ai/llm.service';
import { githubService, GithubAnalysisError } from '../github/github.service';
import { logger } from '../../shared/logger';

type ProposalValidation = {
  valid: boolean;
  isNovel: boolean;
  isQualifiable: boolean;
  correctCategory: boolean;
  reason: string;
  normalizedStatement: string;
  suggestedShortName: string;
  suggestedDifficulty: string;
};

function normalize(s: string) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Cheap similarity check used by both the heuristic fallback and as a guard
// rail before we ever bother calling the LLM.
function isTooSimilar(a: string, b: string) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wordsA = new Set(na.split(' ').filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(' ').filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let overlap = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) overlap++;
  });
  const ratio = overlap / Math.min(wordsA.size, wordsB.size);
  return ratio > 0.7;
}

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
  if (type === 'Hardware') return 'H';
  if (type === 'Hardware & Software') return 'HS';
  return 'S';
}

export const catalogController = {
  // Get all catalog items with the number of times they've been selected.
  // Supports optional ?type=&domain=&sector= filters for the guided flow.
  async getCatalog(req: Request, res: Response) {
    try {
      const { type, domain, sector } = req.query as {
        type?: string;
        domain?: string;
        sector?: string;
      };

      const templates = await prisma.project.findMany({
        where: {
          isTemplate: true,
          status: 'CATALOG',
          ...(type ? { type } : {}),
          ...(domain ? { domain } : {}),
          ...(sector ? { sector } : {}),
        },
        include: {
          _count: {
            select: { childProjects: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json(templates);
    } catch (error) {
      console.error('Error fetching catalog:', error);
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
  async validateProposal(req: Request, res: Response) {
    try {
      const { type, domain, sector, proposedStatement } = req.body as {
        type: string;
        domain: string;
        sector: string;
        proposedStatement: string;
      };

      if (!type || !domain || !proposedStatement) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
      }

      const existingInDomain = await prisma.project.findMany({
        where: { isTemplate: true, status: 'CATALOG', domain },
        select: { problemStatement: true, shortName: true, sector: true, type: true },
      });

      const exactDuplicate = existingInDomain.some((p) =>
        isTooSimilar(p.problemStatement || '', proposedStatement),
      );

      const heuristicFallback: ProposalValidation = {
        valid: !exactDuplicate,
        isNovel: !exactDuplicate,
        isQualifiable: proposedStatement.trim().split(/\s+/).length >= 8,
        correctCategory: true,
        reason: exactDuplicate
          ? 'This looks very similar to an existing problem statement in this domain.'
          : 'Looks novel for this domain based on a keyword comparison (AI validation unavailable).',
        normalizedStatement: proposedStatement.trim(),
        suggestedShortName: proposedStatement.trim().slice(0, 40),
        suggestedDifficulty: '2',
      };

      if (exactDuplicate) {
        // Don't even bother calling the LLM if it's an obvious duplicate.
        return res.json(heuristicFallback);
      }

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are validating a student-proposed project problem statement for a college ' +
            'project catalog. Respond ONLY with a JSON object matching this shape: ' +
            '{"valid": boolean, "isNovel": boolean, "isQualifiable": boolean, ' +
            '"correctCategory": boolean, "reason": string, "normalizedStatement": string, ' +
            '"suggestedShortName": string, "suggestedDifficulty": string}. ' +
            'isQualifiable means the statement is a real, scoped, buildable project (not vague, ' +
            'not trivial, not just a topic name). correctCategory means the statement genuinely ' +
            'belongs to the given category/domain/subdomain rather than another one. valid is ' +
            'true only if isNovel, isQualifiable and correctCategory are all true. ' +
            'suggestedDifficulty is one of "0","1","2","3","4" (0=easiest).',
        },
        {
          role: 'user',
          content: JSON.stringify({
            category: type,
            domain,
            subdomain: sector,
            proposedStatement,
            existingStatementsInDomain: existingInDomain.slice(0, 30).map((p) => ({
              shortName: p.shortName,
              subdomain: p.sector,
              statement: p.problemStatement,
            })),
          }),
        },
      ];

      const result = await chatJSON<ProposalValidation>(messages, heuristicFallback);
      res.json(result);
    } catch (error) {
      console.error('Error validating proposal:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  // Persist a validated + user-confirmed proposal straight into the shared
  // catalog (no approval gate) as a new selectable template.
  async proposeProblemStatement(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.organizationId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      }

      const { type, domain, sector, statement, shortName, difficultyLevel } = req.body as {
        type: string;
        domain: string;
        sector?: string;
        statement: string;
        shortName?: string;
        difficultyLevel?: string;
      };

      if (!type || !domain || !statement) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Missing required fields' });
      }

      const prefix = typeToPrefix(type);
      const problemId = await generateProblemId(prefix);
      const finalShortName = (shortName || statement).trim().slice(0, 60);

      const created = await prisma.project.create({
        data: {
          organizationId: user.organizationId,
          name: finalShortName,
          problemStatement: statement.trim(),
          domain,
          sector: sector || null,
          difficultyLevel: difficultyLevel || '2',
          type,
          problemId,
          shortName: finalShortName,
          status: 'CATALOG',
          isTemplate: true,
        },
        include: {
          _count: { select: { childProjects: true } },
        },
      });

      res.status(StatusCodes.CREATED).json(created);
    } catch (error) {
      console.error('Error proposing problem statement:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  // Post-selection mentor conversation: discusses implementation plan/niche,
  // then (mode="report") produces a readiness summary that unlocks selection.
  async mentor(req: Request, res: Response) {
    try {
      const { templateId, history = [], userMessage, mode } = req.body as {
        templateId: string;
        history: ChatMessage[];
        userMessage?: string;
        mode: 'chat' | 'report';
      };

      const template = await prisma.project.findUnique({ where: { id: templateId } });
      if (!template) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Problem statement not found' });
      }

      const systemPrompt: ChatMessage = {
        role: 'system',
        content:
          `You are a project mentor helping a student team scope out how they will build ` +
          `the following problem statement:\n\n"${template.problemStatement}"\n` +
          `(Domain: ${template.domain}, Subdomain: ${template.sector || 'N/A'}, ` +
          `Difficulty: ${template.difficultyLevel}, Type: ${template.type}).\n\n` +
          `Ask short, focused follow-up questions about: their implementation plan, main ` +
          `technical approach, and what will make their execution distinct/high-quality ` +
          `(their "niche" or quality-control angle). Keep replies to 2-4 sentences. Do not ` +
          `repeat questions already answered in the conversation.`,
      };

      if (mode === 'report') {
        const fallbackReport =
          `Problem statement: ${template.shortName || template.name}.\n` +
          `Domain: ${template.domain} / ${template.sector || 'N/A'}. Difficulty: ` +
          `${template.difficultyLevel}.\nBased on the discussion, the team has outlined an ` +
          `implementation approach and a plan to ensure quality and originality. Ready to ` +
          `proceed with team setup.`;

        const reportMessages: ChatMessage[] = [
          systemPrompt,
          ...history,
          {
            role: 'user',
            content:
              'Summarize this conversation into a short readiness report covering: the ' +
              'problem statement, its difficulty, the proposed implementation plan, and the ' +
              "team's quality/originality angle. End with a clear statement that they are " +
              'ready to proceed. Respond with plain text only, no JSON.',
          },
        ];

        const report = await chat(reportMessages, fallbackReport);
        return res.json({ ready: true, report });
      }

      const fallbackReply =
        "Thanks — that gives a good sense of direction. Could you tell me a bit more about " +
        "how your team plans to make this implementation stand out in terms of quality or " +
        "a specific niche within the problem?";

      const chatMessages: ChatMessage[] = [
        systemPrompt,
        ...history,
        ...(userMessage ? [{ role: 'user', content: userMessage } as ChatMessage] : []),
      ];

      const reply = await chat(chatMessages, fallbackReply);
      res.json({ reply });
    } catch (error) {
      console.error('Error in mentor chat:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },

  // Team selects a template to instantiate as their own project
  async selectProject(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.teamId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Must belong to a team' });
      }

      const { id } = req.params;
      const { teamMembers = [], repoLink } = req.body as { teamMembers?: string[]; repoLink?: string };

      if (repoLink) {
        try {
          githubService.parseRepoUrl(repoLink);
        } catch (err) {
          const message = err instanceof GithubAnalysisError ? err.message : 'Invalid GitHub repository link';
          return res.status(StatusCodes.BAD_REQUEST).json({ message });
        }
      }

      // 1. Validate the template exists
      const template = await prisma.project.findUnique({
        where: { id: id as string },
        include: {
          _count: {
            select: { childProjects: true },
          },
        },
      });

      if (!template || !template.isTemplate) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Catalog project not found' });
      }

      // 2. Validate max capacity (3 to 4 teams)
      const childCount = (template as any)._count?.childProjects || 0;
      if (childCount >= 4) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'Maximum capacity (4 teams) reached for this project' });
      }

      // 3. Ensure this team hasn't already selected it
      const alreadySelected = await prisma.project.findFirst({
        where: {
          parentProjectId: template.id,
          teamId: user.teamId,
        },
      });

      if (alreadySelected) {
        return res
          .status(StatusCodes.CONFLICT)
          .json({ message: 'Your team has already selected this project' });
      }

      // 4. Instantiate the project for this team
      const newProject = await prisma.project.create({
        data: {
          organizationId: template.organizationId,
          teamId: user.teamId,
          parentProjectId: template.id,
          name: template.name,
          description: template.description,
          domain: template.domain,
          difficultyLevel: template.difficultyLevel,
          type: template.type,
          problemStatement: template.problemStatement,
          objective: template.objective,
          expectedOutcome: template.expectedOutcome,
          technologies: template.technologies,
          repoLink: repoLink || undefined,
          status: 'pending_approval',
        },
      });

      // 5. Add team members (leader + selected members)
      const projectMembers = [
        { projectId: newProject.id, userId: user.id, role: 'ADMIN' as const },
        ...teamMembers.slice(0, 3).map((memberId: string) => ({
          projectId: newProject.id,
          userId: memberId,
          role: 'STUDENT' as const,
        })),
      ];

      await prisma.projectMember.createMany({
        data: projectMembers,
      });

      if (newProject.repoLink) {
        githubService.analyzeAndLinkProject(newProject.id, newProject.repoLink).catch((err) => {
          logger.error('Background GitHub analysis failed on project selection', {
            projectId: newProject.id,
            message: err?.message,
          });
        });
      }

      res.status(StatusCodes.CREATED).json(newProject);
    } catch (error) {
      console.error('Error selecting project:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  },
};
