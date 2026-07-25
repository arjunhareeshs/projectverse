import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';
import { chatJSON, ChatMessage } from '../ai/llm.service';
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

// Word-overlap ratio (0-1), shared by the duplicate guard and the
// "related work" ranking used for the mentor's differentiation challenge.
function wordOverlapRatio(a: string, b: string) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wordsA = new Set(na.split(' ').filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(' ').filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) overlap++;
  });
  return overlap / Math.min(wordsA.size, wordsB.size);
}

// Cheap similarity check used by both the heuristic fallback and as a guard
// rail before we ever bother calling the LLM.
function isTooSimilar(a: string, b: string) {
  return wordOverlapRatio(a, b) > 0.7;
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
          `You are a project mentor helping a student team scope out how they will build ` +
          `the following problem statement:\n\n"${template.problemStatement}"\n` +
          `(Domain: ${template.domain}, Subdomain: ${template.sector || 'N/A'}, ` +
          `Difficulty: ${template.difficultyLevel}, Type: ${template.type}).\n\n` +
          (relatedWork
            ? `Other related problem statements already in this domain, for context:\n${relatedWork}\n\n` +
              `Early in the conversation (but only once), ask the team to explain how their ` +
              `approach will be different from these related statements.\n\n`
            : '') +
          `Your goal is to get the team to clearly articulate, across the conversation: their ` +
          `problem understanding, target users, unique value/differentiation, tech stack, MVP ` +
          `scope, timeline (how many weeks/months they have), key risks, and success metrics. ` +
          `Ask one short, focused follow-up question at a time (2-4 sentences). Do not repeat ` +
          `questions already answered. If the team's scope looks too large for the timeline ` +
          `they mention, push back and suggest cutting scope to an MVP.\n\n` +
          `Respond ONLY with a JSON object: {"reply": string, "checklist": {${CHECKLIST_DIMENSIONS.map((d) => `"${d.id}": boolean`).join(', ')}}, "readinessScore": number}. ` +
          `The checklist booleans mean "has this been clearly covered in the conversation so far ` +
          `(including this reply's question)". readinessScore is 0-100, how ready the team is to ` +
          `move to a readiness report. Dimensions: ${dimensionList}.`,
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
          "Thanks — that gives a good sense of direction. Could you tell me a bit more about " +
          "how your team plans to make this implementation stand out in terms of quality or " +
          "a specific niche within the problem?",
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

  // Team selects a template to instantiate as their own project
  async selectProject(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user || !user.teamId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Must belong to a team' });
      }

      const { id } = req.params;
      const { teamMembers = [], repoLink, plan } = req.body as {
        teamMembers?: string[];
        repoLink?: string;
        plan?: ExtractedPlan;
      };

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

      // 4. Instantiate the project for this team, folding in the mentor's
      // extracted plan (target users, MoSCoW scope, risks, metrics) when the
      // team completed the readiness report before selecting.
      const moscowText = plan?.moscow
        ? [
            plan.moscow.must?.length ? `Must-have: ${plan.moscow.must.join('; ')}` : '',
            plan.moscow.should?.length ? `Should-have: ${plan.moscow.should.join('; ')}` : '',
            plan.moscow.could?.length ? `Could-have: ${plan.moscow.could.join('; ')}` : '',
            plan.moscow.wont?.length ? `Won't-have: ${plan.moscow.wont.join('; ')}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        : undefined;

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
          objective: plan?.targetUsers ? `Target users: ${plan.targetUsers}` : template.objective,
          expectedOutcome: plan?.successMetrics?.length
            ? `Success metrics: ${plan.successMetrics.join('; ')}`
            : template.expectedOutcome,
          technologies: plan?.techStack?.length ? plan.techStack : template.technologies,
          requirements: moscowText,
          innovation: plan?.uniqueValue || undefined,
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
