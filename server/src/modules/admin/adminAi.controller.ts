import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';
import { chat, chatJSON, isLlmConfigured } from '../ai/llm.service';
import { projectLogService } from '../lifecycle/projectLog.service';
import { buildAdminClassifierPrompt, buildAdminAnswerPrompt } from '../lifecycle/prompts/adminAssistant.prompt';
import { AdminService } from './admin.service';
import { RankingService } from '../ranking/ranking.service';

// ── Fuzzy person-name matching ────────────────────────────────────────────────
// Admins often ask about a person by name ("team where X is captain") without
// knowing the exact spelling or the team/project name. Plain substring matching
// on project/team names (below) misses these entirely. This does a cheap
// Levenshtein-tolerant token match against every student's full name.

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

// Similarity in [0,1] — 1 for identical strings, tolerant of typos/phonetic misspellings
// proportional to word length (short common words like "syed" alone shouldn't be decisive).
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
    // Require a full first+last name (both ≥4 chars) — a single usable token (e.g. "RISHI C") is
    // too easily confused with an ordinary English word ("risk") in an unrelated question.
    if (nameTokens.length < 2) continue;

    // Average, per name-token, its similarity to whichever question-token matches it best.
    // Continuous scoring (vs a hard match/no-match threshold) means a strong distinguishing
    // surname match can correctly outrank a same-first-name-only collision.
    let maxSim = 0;
    const totalSim = nameTokens.reduce((sum, nt) => {
      const bestSim = qTokens.reduce((max, qt) => Math.max(max, tokenSimilarity(nt, qt)), 0);
      if (bestSim > maxSim) maxSim = bestSim;
      return sum + bestSim;
    }, 0);
    const avgSim = totalSim / nameTokens.length;

    if (!best || avgSim > best.avgSim) best = { student: s, avgSim, maxSim };
  }

  // Require both a decent overall match AND at least one strongly-matched token (usually the
  // surname) — two mediocre partial matches averaging over the bar isn't enough on its own.
  return best && best.avgSim >= 0.6 && best.maxSim >= 0.75 ? best.student : null;
}

// ── Lean prompt context ─────────────────────────────────────────────────────────
// AdminService.getTeamDetail/getStudentDetail return full Prisma objects (internal IDs,
// booleans, nested per-member skill arrays, raw ranking sub-fields) meant for the UI —
// dumping them straight into an LLM prompt wastes tokens on noise the model doesn't need,
// which both degrades answer quality and risks hitting the provider's per-minute token cap.
function summarizeTeamForPrompt(team: any) {
  const activeProject = team.projects?.[0];
  return {
    name: team.name,
    domain: team.domain,
    groupCode: team.groupCode,
    performance: {
      score: team.liveRanking?.score,
      rank: team.liveRanking?.rank,
      domainRank: team.liveRanking?.domainRank,
      domainPercentile: team.liveRanking?.domainPercentile,
      categories: team.liveRanking?.categories,
      plagiarismRisk: team.liveRanking?.plagiarismRisk,
    },
    activeProject: activeProject
      ? { name: activeProject.name, description: activeProject.description, status: activeProject.status }
      : null,
    members: (team.members || []).map((m: any) => ({
      name: m.fullName,
      regNo: m.regNo,
      isLead: team.leadId === m.id,
      performanceScore: m.performanceScore,
      topSkills: (m.userSkills || []).slice(0, 3).map((s: any) => s.skillName),
    })),
    achievements: (team.achievements || []).map((a: any) => ({ title: a.title, points: a.points })),
    domainPeers: (team.domainPeers || []).map((p: any) => ({ name: p.name, score: p.score })),
  };
}

function summarizeStudentForPrompt(student: any) {
  return {
    fullName: student.fullName,
    regNo: student.regNo,
    domain: student.ssgDomain || student.team?.domain,
    department: student.department,
    year: student.year,
    performance: {
      score: student.performanceScore,
      rank: student.rank,
      categories: student.liveRanking?.categories,
    },
    team: student.team ? { name: student.team.name, domain: student.team.domain, groupCode: student.team.groupCode } : null,
    skills: (student.userSkills || []).map((s: any) => ({ skillName: s.skillName, totalPoints: s.totalPoints })),
  };
}

export async function askAdminAi(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id || 'system-admin';
    const { question, sessionId = 'default-admin-session', pinnedTeamId, pinnedStudentId } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(StatusCodes.BAD_REQUEST).json({ message: 'Question is required' });
      return;
    }

    const persistAndReply = async (
      answer: string,
      scope: string,
      projectsUsed: Array<{ id: string; title: string }>,
      pinnedContext: { type: 'team' | 'student'; id: string; name: string } | null,
    ) => {
      try {
        await prisma.adminChatHistory.create({ data: { userId, sessionId, prompt: question, response: answer } });
      } catch (e: any) {
        console.warn('Could not persist AdminChatHistory:', e.message);
      }
      res.status(StatusCodes.OK).json({ answer, scope, projectsUsed, pinnedContext });
    };

    const answerFrom = async (scope: string, loadedPayloads: Record<string, any>, fallbackName: string) => {
      if (!isLlmConfigured()) {
        return `[Admin AI Offline Mode] Loaded real context for ${fallbackName}: ${JSON.stringify(loadedPayloads, null, 2)}`;
      }
      const answerPrompt = buildAdminAnswerPrompt(question, scope, loadedPayloads);
      const fallback = 'Admin AI Assistant is unable to answer at this time. Please inspect project logs directly.';
      return chat(answerPrompt, fallback);
    };

    // ── Pinned context fast-path ────────────────────────────────────────────
    // The admin clicked a specific team/student card in the chat's context panel —
    // skip classification entirely and ground the answer in that record's full
    // real data (ranking, roster, active project, evaluations, GitHub, achievements).
    if (pinnedTeamId || pinnedStudentId) {
      let pinnedContext: { type: 'team' | 'student'; id: string; name: string } | null = null;
      let scope: string;
      const loadedPayloads: Record<string, any> = {};
      const projectsUsed: Array<{ id: string; title: string }> = [];

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
            // project has no lifecycle log initialized yet — fine, ranking/roster data still answers most questions
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
      } else {
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
    const normQ = question.toLowerCase();
    const matched = projects.filter((p) => normQ.includes(p.name.toLowerCase()) || (p.team?.name && normQ.includes(p.team.name.toLowerCase())));

    // ── Person-name fast-path ────────────────────────────────────────────────
    // No project/team name was mentioned verbatim — check if the question is
    // actually about a specific person (by name, however misspelled), e.g.
    // "tell me about the team where Syed is the captain". Resolve them to their
    // team and answer with full real context, same as a pinned lookup.
    if (matched.length === 0) {
      const person = await findStudentByFuzzyName(question);
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
            // The question was framed around the team — ground the reply on the team, with the person's role noted.
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
      classification = await chatJSON(classifierPrompt, fallback);
    }

    // Load only requested context payloads
    const loadedPayloads: Record<string, any> = {};
    const projectsUsed: Array<{ id: string; title: string }> = [];

    if (classification.scope === 'cohort' || classification.projectIds.length === 0) {
      loadedPayloads.cohortStats = await buildCohortDigest(projects);
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

// ── Cohort-wide analytics digest ───────────────────────────────────────────────
// Broad questions ("which projects have HIGH plagiarism risk", "which teams are
// at risk", "top performers") need real cross-project analytics, not just counts.
// This builds a compact, LLM-friendly digest from data that already exists —
// EvaluationReport risk ratings + the live RankingService scores — instead of
// silently answering "insufficient data" when the data is actually there.
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
