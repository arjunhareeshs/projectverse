import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';
import { chat, chatJSON, isLlmConfigured } from '../ai/llm.service';
import { projectLogService } from '../lifecycle/projectLog.service';
import { buildAdminClassifierPrompt, buildAdminAnswerPrompt } from '../lifecycle/prompts/adminAssistant.prompt';
import { AdminService } from './admin.service';
import { RankingService } from '../ranking/ranking.service';

// ── Fuzzy person-name matching ────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function tokenSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(a, b) / maxLen;
}

async function findStudentByFuzzyName(question: string) {
  const qTokens = question
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  if (qTokens.length === 0) return null;

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, fullName: true, teamId: true, teamRole: true },
  });

  let best: { student: (typeof students)[number]; avgSim: number; maxSim: number } | null = null;
  for (const s of students) {
    const nameTokens = s.fullName.toLowerCase().split(/\s+/).filter((t) => t.length >= 4);
    if (nameTokens.length < 2) continue;

    let maxSim = 0;
    const totalSim = nameTokens.reduce((sum, nt) => {
      const bestSim = qTokens.reduce((max, qt) => Math.max(max, tokenSimilarity(nt, qt)), 0);
      if (bestSim > maxSim) maxSim = bestSim;
      return sum + bestSim;
    }, 0);
    const avgSim = totalSim / nameTokens.length;

    if (!best || avgSim > best.avgSim) best = { student: s, avgSim, maxSim };
  }

  return best && best.avgSim >= 0.6 && best.maxSim >= 0.75 ? best.student : null;
}

// 5.1 Fuzzy project name matching
function findProjectByFuzzyName(question: string, projects: any[]) {
  const qTokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  if (qTokens.length === 0) return null;

  let best: { project: any; maxSim: number } | null = null;
  for (const p of projects) {
    const pTokens = (p.name || '').toLowerCase().split(/\s+/).filter((t: string) => t.length >= 4);
    if (pTokens.length === 0) continue;

    let maxSim = 0;
    pTokens.forEach((pt: string) => {
      qTokens.forEach((qt: string) => {
        const sim = tokenSimilarity(pt, qt);
        if (sim > maxSim) maxSim = sim;
      });
    });

    if (maxSim >= 0.75 && (!best || maxSim > best.maxSim)) {
      best = { project: p, maxSim };
    }
  }

  return best ? best.project : null;
}

// ── Lean prompt context ─────────────────────────────────────────────────────────
function summarizeTeamForPrompt(team: any) {
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    memberCount: team.members?.length || 0,
    members: (team.members || []).map((m: any) => ({
      name: m.fullName,
      role: m.teamRole,
      department: m.department,
    })),
    rank: team.rank?.domainRank ? `#${team.rank.domainRank} in ${team.rank.domain}` : 'Unranked',
    overallScore: team.rank?.overallScore != null ? `${Math.round(team.rank.overallScore * 100)}%` : 'N/A',
    categories: team.rank?.categories
      ? {
          execution: `${Math.round((team.rank.categories.execution || 0) * 100)}%`,
          productivity: `${Math.round((team.rank.categories.productivity || 0) * 100)}%`,
          quality: `${Math.round((team.rank.categories.quality || 0) * 100)}%`,
          collaboration: `${Math.round((team.rank.categories.collaboration || 0) * 100)}%`,
        }
      : null,
    activeProject: team.projects?.[0]
      ? { id: team.projects[0].id, name: team.projects[0].name, status: team.projects[0].status }
      : null,
  };
}

function summarizeStudentForPrompt(student: any) {
  if (!student) return null;
  return {
    id: student.id,
    name: student.fullName,
    email: student.email,
    department: student.department,
    teamName: student.team?.name || 'Unassigned',
    teamRole: student.teamRole,
    rank: student.rank?.domainRank ? `#${student.rank.domainRank} in ${student.rank.domain}` : 'Unranked',
    overallScore: student.rank?.overallScore != null ? `${Math.round(student.rank.overallScore * 100)}%` : 'N/A',
    categories: student.rank?.categories
      ? {
          execution: `${Math.round((student.rank.categories.execution || 0) * 100)}%`,
          productivity: `${Math.round((student.rank.categories.productivity || 0) * 100)}%`,
          quality: `${Math.round((student.rank.categories.quality || 0) * 100)}%`,
          collaboration: `${Math.round((student.rank.categories.collaboration || 0) * 100)}%`,
        }
      : null,
    skills: (student.userSkills || []).map((s: any) => s.skillName),
    achievementsCount: student.achievements?.length || 0,
  };
}

export async function askAdminAi(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const userId = user?.id || 'admin-system';

    const { question = '', sessionId, pinnedTeamId, pinnedStudentId } = req.body as {
      question?: string;
      sessionId?: string;
      pinnedTeamId?: string;
      pinnedStudentId?: string;
    };

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Question is required' });
      return;
    }

    const currentSessionId = sessionId || `admin-session-${Date.now()}`;

    // 5.4 Load Conversational Memory (last 3 turns for this session)
    let recentTurnsHistory: Array<{ question: string; answer: string }> = [];
    if (currentSessionId) {
      const pastHistory = await prisma.adminChatHistory.findMany({
        where: { sessionId: currentSessionId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
      recentTurnsHistory = pastHistory.reverse().map((h) => ({
        question: h.prompt,
        answer: h.response,
      }));
    }

    async function answerFrom(scope: string, loadedData: any, logContextName: string) {
      if (!isLlmConfigured()) {
        return `[Offline Mode] Data loaded for scope "${scope}" (${logContextName}). AI key is not configured for complete executive summary narration.`;
      }
      const prompt = buildAdminAnswerPrompt(trimmedQuestion, scope, loadedData, recentTurnsHistory);
      const fallback = `Summary for scope "${scope}": Data retrieved successfully for ${logContextName}.`;
      return chat(prompt, fallback, { feature: 'adminAi' });
    }

    async function persistAndReply(
      answerText: string,
      scope: string,
      projectsUsed: Array<{ id: string; title: string }>,
      pinnedCtx: { type: 'team' | 'student'; id: string; name: string } | null,
    ) {
      const record = await AdminService.saveAdminChat(userId, trimmedQuestion, answerText, currentSessionId);

      res.json({
        id: record.id,
        sessionId: currentSessionId,
        question: trimmedQuestion,
        answer: answerText,
        scope,
        projectsUsed,
        pinnedContext: pinnedCtx,
        createdAt: record.createdAt,
      });
    }

    // Fast-path: Pinned entity
    if (pinnedTeamId || pinnedStudentId) {
      let scope = '';
      const loadedPayloads: Record<string, any> = {};
      const projectsUsed: Array<{ id: string; title: string }> = [];
      let pinnedContext: { type: 'team' | 'student'; id: string; name: string } | null = null;

      if (pinnedTeamId) {
        const team = await AdminService.getTeamDetail(pinnedTeamId);
        if (!team) {
          res.status(StatusCodes.NOT_FOUND).json({ message: 'Pinned team not found' });
          return;
        }
        scope = 'pinned-team';
        pinnedContext = { type: 'team', id: team.id, name: team.name };
        loadedPayloads.team = summarizeTeamForPrompt(team);

        const activeProject = team.projects?.[0];
        if (activeProject) {
          projectsUsed.push({ id: activeProject.id, title: activeProject.name });
          try {
            loadedPayloads.projectLog = await projectLogService.getContext(activeProject.id, 'admin');
          } catch {
            // fine
          }
          const evalRep = await prisma.evaluationReport.findFirst({
            where: { projectId: activeProject.id },
            orderBy: { cycle: 'desc' },
          });
          if (evalRep) loadedPayloads.latestEvaluationReport = evalRep.content;

          const ghRepo = await prisma.githubRepository.findUnique({
            where: { projectId: activeProject.id },
            include: { commits: { take: 5, orderBy: { date: 'desc' } } },
          });
          if (ghRepo) {
            loadedPayloads.githubSummary = {
              fullName: `${ghRepo.owner}/${ghRepo.repository}`,
              commitCount: ghRepo.commitCount,
              openIssues: ghRepo.openIssues,
              openPullRequests: ghRepo.openPullRequests,
              recentCommits: ghRepo.commits.map((c) => ({ author: c.author, message: c.message })),
            };
          }
        }
      } else if (pinnedStudentId) {
        const student = await AdminService.getStudentDetail(pinnedStudentId);
        if (!student) {
          res.status(StatusCodes.NOT_FOUND).json({ message: 'Pinned student not found' });
          return;
        }
        scope = 'pinned-student';
        pinnedContext = { type: 'student', id: student.id, name: student.fullName };
        loadedPayloads.student = summarizeStudentForPrompt(student);
      }

      const answer = await answerFrom(scope, loadedPayloads, pinnedContext!.name);
      await persistAndReply(answer, scope, projectsUsed, pinnedContext);
      return;
    }

    // Index active projects
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        team: { select: { name: true } },
      },
    });

    const projectIndex = projects.map((p) => ({
      id: p.id,
      title: p.name,
      teamName: p.team?.name || 'Unassigned',
      category: p.category || 'FINAL_YEAR',
    }));

    // Deterministic pre-pass for verbatim project/team name matching
    const normQ = trimmedQuestion.toLowerCase();
    let matched = projects.filter((p) => normQ.includes(p.name.toLowerCase()) || (p.team?.name && normQ.includes(p.team.name.toLowerCase())));

    // 5.1 Fuzzy project-name matching if no verbatim match
    if (matched.length === 0) {
      const fuzzyProj = findProjectByFuzzyName(trimmedQuestion, projects);
      if (fuzzyProj) {
        matched.push(fuzzyProj);
      }
    }

    // ── Person-name fast-path ────────────────────────────────────────────────
    if (matched.length === 0) {
      const person = await findStudentByFuzzyName(trimmedQuestion);
      if (person) {
        const student = await AdminService.getStudentDetail(person.id);
        const loadedPayloads: Record<string, any> = {
          student: summarizeStudentForPrompt(student),
          roleInTeam: person.teamRole,
        };
        const projectsUsed: Array<{ id: string; title: string }> = [];
        let pinnedContext: { type: 'team' | 'student'; id: string; name: string } = {
          type: 'student',
          id: student!.id,
          name: student!.fullName,
        };

        if (person.teamId) {
          const team = await AdminService.getTeamDetail(person.teamId);
          if (team) {
            loadedPayloads.team = summarizeTeamForPrompt(team);
            const activeProject = team.projects?.[0];
            if (activeProject) projectsUsed.push({ id: activeProject.id, title: activeProject.name });
            pinnedContext = { type: 'team', id: team.id, name: team.name };
          }
        }

        const scope = 'person-lookup';
        const answer = await answerFrom(scope, loadedPayloads, pinnedContext.name);
        await persistAndReply(answer, scope, projectsUsed, pinnedContext);
        return;
      }
    }

    let classification: { scope: string; projectIds: string[]; needsGithub: boolean; needsEvaluations: boolean };

    if (matched.length > 0) {
      classification = {
        scope: matched.length === 1 ? 'single' : 'compare',
        projectIds: matched.slice(0, 5).map((m) => m.id),
        needsGithub: normQ.includes('github') || normQ.includes('commit') || normQ.includes('code'),
        needsEvaluations: normQ.includes('eval') || normQ.includes('score') || normQ.includes('plagiarism') || normQ.includes('report'),
      };
    } else if (!isLlmConfigured()) {
      classification = {
        scope: 'cohort',
        projectIds: [],
        needsGithub: false,
        needsEvaluations: false,
      };
    } else {
      const classifierPrompt = buildAdminClassifierPrompt(question, projectIndex);
      const fallback = { scope: 'cohort', projectIds: [], needsGithub: false, needsEvaluations: false };
      classification = await chatJSON(classifierPrompt, fallback, { feature: 'adminClassifier' });
    }

    // Load only requested context payloads
    const loadedPayloads: Record<string, any> = {};
    const projectsUsed: Array<{ id: string; title: string }> = [];

    if (classification.scope === 'cohort' || classification.projectIds.length === 0) {
      loadedPayloads.cohortStats = await getCachedCohortDigest(projects);
    } else {
      for (const pId of classification.projectIds.slice(0, 5)) {
        const proj = projects.find((p) => p.id === pId);
        if (!proj) continue;

        projectsUsed.push({ id: proj.id, title: proj.name });

        const adminContext = await projectLogService.getContext(proj.id, 'admin');
        const projData: any = { adminContext };

        if (classification.needsEvaluations) {
          const evalRep = await prisma.evaluationReport.findFirst({
            where: { projectId: proj.id },
            orderBy: { cycle: 'desc' },
          });
          projData.latestEvaluationReport = evalRep?.content || null;
        }

        if (classification.needsGithub) {
          const ghRepo = await prisma.githubRepository.findUnique({
            where: { projectId: proj.id },
            include: {
              snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
              commits: { take: 5, orderBy: { date: 'desc' } },
            },
          });
          projData.githubSummary = ghRepo
            ? {
                fullName: `${ghRepo.owner}/${ghRepo.repository}`,
                latestCommitCount: ghRepo.commits.length,
                recentCommits: ghRepo.commits.map((c) => ({ author: c.author, message: c.message })),
              }
            : null;
        }

        loadedPayloads[proj.name] = projData;
      }
    }

    const answer = await answerFrom(classification.scope, loadedPayloads, 'cohort');
    await persistAndReply(answer, classification.scope, projectsUsed, null);
  } catch (err: any) {
    console.error('Error in askAdminAi:', err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: err.message || 'Failed to process admin question' });
  }
}

// 5.3 Cohort Digest Cache with 3-minute TTL
let cohortDigestCache: { timestamp: number; data: any } | null = null;

async function getCachedCohortDigest(projects: any[]) {
  const now = Date.now();
  if (cohortDigestCache && now - cohortDigestCache.timestamp < 3 * 60 * 1000) {
    return cohortDigestCache.data;
  }
  const data = await buildCohortDigest(projects);
  cohortDigestCache = { timestamp: now, data };
  return data;
}

// ── Cohort-wide analytics digest ───────────────────────────────────────────────
async function buildCohortDigest(projects: Array<{ id: string; name: string; category: string | null; team: { name: string | null } | null }>) {
  const totalProjects = projects.length;
  const categoriesCount: Record<string, number> = {};
  projects.forEach((p) => {
    const cat = p.category || 'FINAL_YEAR';
    categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
  });

  const allEvalReports = await prisma.evaluationReport.findMany({
    select: { projectId: true, cycle: true, content: true },
  });
  const latestEvalByProject = new Map<string, { cycle: number; content: any }>();
  for (const r of allEvalReports) {
    const existing = latestEvalByProject.get(r.projectId);
    if (!existing || r.cycle > existing.cycle) latestEvalByProject.set(r.projectId, { cycle: r.cycle, content: r.content });
  }

  const riskCounts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const highRiskProjects: Array<{ project: string; team: string }> = [];
  const mediumRiskProjects: Array<{ project: string; team: string }> = [];
  for (const [projectId, r] of latestEvalByProject) {
    const risk = (r.content as any)?.plagiarismRisk;
    if (risk && riskCounts[risk] !== undefined) riskCounts[risk] += 1;
    if (risk === 'HIGH' || risk === 'MEDIUM') {
      const proj = projects.find((p) => p.id === projectId);
      const entry = { project: proj?.name || projectId, team: proj?.team?.name || 'Unassigned' };
      (risk === 'HIGH' ? highRiskProjects : mediumRiskProjects).push(entry);
    }
  }

  const [teamRankings, studentRankings] = await Promise.all([RankingService.getTeamRankings(), RankingService.getStudentRankings()]);
  const activeTeamRankings = teamRankings.filter((r) => r.hasActivity);
  const atRiskTeams = [...activeTeamRankings].sort((a, b) => a.score - b.score).slice(0, 15).filter((r) => r.score < 40);
  const topTeamsRaw = [...activeTeamRankings].sort((a, b) => b.score - a.score).slice(0, 10);
  const activeStudentRankings = studentRankings.filter((r) => r.hasActivity);
  const topStudentsRaw = [...activeStudentRankings].sort((a, b) => b.score - a.score).slice(0, 10);

  const teamIds = Array.from(new Set([...atRiskTeams, ...topTeamsRaw].map((r) => r.teamId)));
  const teamNameRows = teamIds.length ? await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }) : [];
  const teamNameMap = new Map(teamNameRows.map((t) => [t.id, t.name]));

  const studentIds = topStudentsRaw.map((r) => r.userId);
  const studentNameRows = studentIds.length ? await prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, fullName: true } }) : [];
  const studentNameMap = new Map(studentNameRows.map((s) => [s.id, s.fullName]));

  const avgScores = await prisma.evaluationReport.aggregate({ _avg: { cycle: true }, _count: { id: true } });

  return {
    totalProjects,
    categoriesCount,
    totalEvaluationsCompleted: avgScores._count.id,
    plagiarismRiskSummary: {
      evaluatedProjects: latestEvalByProject.size,
      counts: riskCounts,
      highRiskProjects,
      mediumRiskProjects,
    },
    atRiskTeams: atRiskTeams.map((r) => ({ team: teamNameMap.get(r.teamId) || r.teamId, score: r.score })),
    topTeams: topTeamsRaw.map((r) => ({ team: teamNameMap.get(r.teamId) || r.teamId, score: r.score })),
    topStudents: topStudentsRaw.map((r) => ({ student: studentNameMap.get(r.userId) || r.userId, score: r.score })),
  };
}
