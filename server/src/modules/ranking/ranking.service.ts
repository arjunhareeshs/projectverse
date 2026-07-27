import { prisma } from '../../shared/database';
import type { ProjectLogState, EvaluationReportContent } from '../../shared/projectLog.types';

// ─── Weights ────────────────────────────────────────────────────────────────
// score = execution*EXECUTION_W + productivity*PRODUCTIVITY_W + quality*QUALITY_W + collaboration*COLLABORATION_W
const EXECUTION_W = 0.35;
const PRODUCTIVITY_W = 0.25;
const QUALITY_W = 0.25;
const COLLABORATION_W = 0.15;

// GitHub commit-volume normalization ceiling — commitCount at/above this is treated as "fully productive" on GitHub
const COMMIT_CEILING = 150;

export interface CategoryBreakdown {
  execution: number; // 0-1
  productivity: number; // 0-1
  quality: number; // 0-1
  collaboration: number; // 0-1
}

export interface TeamRankingResult {
  teamId: string;
  score: number; // 0-100
  rank: number;
  domain: string | null;
  domainRank: number | null;
  domainPercentile: number | null;
  deadlineCompleteness: number; // 0-1 — task-level, folded into execution
  finishment: number; // 0-1 — task+work-package level, folded into execution
  productivity: number; // 0-1 — logs+GitHub, also the productivity category
  categories: CategoryBreakdown;
  githubLinked: boolean;
  plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  hasActivity: boolean;
}

export interface StudentRankingResult {
  userId: string;
  score: number; // 0-100
  rank: number;
  domain: string | null;
  domainRank: number | null;
  domainPercentile: number | null;
  deadlineCompleteness: number;
  finishment: number;
  productivity: number;
  categories: CategoryBreakdown;
  githubLinked: boolean;
  hasActivity: boolean;
}

function countWeekdays(startDate: Date, endDate: Date = new Date()): number {
  const cur = new Date(startDate.getTime());
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate.getTime());
  end.setHours(0, 0, 0, 0);

  if (cur >= end) return 1;

  let count = 0;
  let iterations = 0;
  while (cur <= end && iterations < 180) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
    iterations++;
  }
  return Math.max(1, count);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function safeParseLogState(state: unknown): ProjectLogState | null {
  if (!state || typeof state !== 'object') return null;
  return state as ProjectLogState;
}

function safeParseEvalContent(content: unknown): EvaluationReportContent | null {
  if (!content || typeof content !== 'object') return null;
  return content as EvaluationReportContent;
}

function assignDomainRanks<T extends { domain: string | null; score: number }>(
  results: T[],
): Array<T & { domainRank: number | null; domainPercentile: number | null }> {
  const byDomain: Record<string, T[]> = {};
  for (const r of results) {
    const key = r.domain || '__none__';
    (byDomain[key] ||= []).push(r);
  }

  const domainRankMap = new Map<T, { domainRank: number; domainPercentile: number }>();
  for (const key of Object.keys(byDomain)) {
    if (key === '__none__') continue;
    const group = [...byDomain[key]].sort((a, b) => b.score - a.score);
    const total = group.length;
    group.forEach((item, idx) => {
      const domainRank = idx + 1;
      const domainPercentile = total > 1 ? Math.round(((total - domainRank) / (total - 1)) * 100) : 100;
      domainRankMap.set(item, { domainRank, domainPercentile });
    });
  }

  return results.map((r) => {
    const dr = domainRankMap.get(r);
    return { ...r, domainRank: dr?.domainRank ?? null, domainPercentile: dr?.domainPercentile ?? null };
  });
}

export class RankingService {
  /**
   * Compute live team performance rankings across an organization.
   * Pulls from: Task, DailyWorkLog, ProjectLog (milestones/workPackages/flags),
   * EvaluationReport (15-day AI cycles), GithubRepository (+ contributors).
   */
  static async getTeamRankings(organizationId?: string): Promise<TeamRankingResult[]> {
    const whereOrg = organizationId ? { organizationId } : {};

    const teams = await prisma.team.findMany({
      where: whereOrg,
      select: {
        id: true,
        name: true,
        domain: true,
        createdAt: true,
        members: { select: { id: true } },
        projects: {
          where: { isTemplate: false },
          select: { id: true, createdAt: true },
        },
      },
    });

    if (!teams.length) return [];

    const projectToTeamMap: Record<string, string> = {};
    const teamProjectDates: Record<string, Date> = {};
    const teamMemberCount: Record<string, number> = {};

    teams.forEach((t) => {
      let earliestDate = t.createdAt;
      t.projects.forEach((p) => {
        projectToTeamMap[p.id] = t.id;
        if (p.createdAt < earliestDate) earliestDate = p.createdAt;
      });
      teamProjectDates[t.id] = earliestDate;
      teamMemberCount[t.id] = t.members.length;
    });

    const projectIds = Object.keys(projectToTeamMap);

    const [tasks, dailyLogs, projectLogs, evaluationReports, githubRepos] = await Promise.all([
      projectIds.length
        ? prisma.task.findMany({
            where: { projectId: { in: projectIds } },
            select: { id: true, projectId: true, status: true, dueDate: true, completedAt: true },
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.dailyWorkLog.findMany({
            where: { projectId: { in: projectIds } },
            select: { projectId: true, date: true },
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.projectLog.findMany({
            where: { projectId: { in: projectIds } },
            select: { projectId: true, state: true },
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.evaluationReport.findMany({
            where: { projectId: { in: projectIds } },
            select: { projectId: true, content: true, periodEnd: true },
            orderBy: { periodEnd: 'desc' },
          })
        : Promise.resolve([]),
      projectIds.length
        ? prisma.githubRepository.findMany({
            where: { projectId: { in: projectIds } },
            select: {
              projectId: true,
              commitCount: true,
              contributors: { select: { username: true, contributions: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    // ── Task aggregation per team ──────────────────────────────────────────
    const teamTasksAgg: Record<
      string,
      { totalTasks: number; completedTasks: number; tasksWithDueDate: number; onTimeCompletedTasks: number }
    > = {};
    teams.forEach((t) => (teamTasksAgg[t.id] = { totalTasks: 0, completedTasks: 0, tasksWithDueDate: 0, onTimeCompletedTasks: 0 }));

    tasks.forEach((task) => {
      const teamId = projectToTeamMap[task.projectId];
      const agg = teamId && teamTasksAgg[teamId];
      if (!agg) return;
      agg.totalTasks += 1;
      const isCompleted = task.status === 'completed' || task.status === 'done' || !!task.completedAt;
      if (isCompleted) agg.completedTasks += 1;
      if (task.dueDate) {
        agg.tasksWithDueDate += 1;
        if (isCompleted) {
          const compDate = task.completedAt || new Date();
          if (compDate <= task.dueDate) agg.onTimeCompletedTasks += 1;
        }
      }
    });

    // ── Active daily-log days per team ─────────────────────────────────────
    const teamActiveDaysMap: Record<string, Set<string>> = {};
    teams.forEach((t) => (teamActiveDaysMap[t.id] = new Set<string>()));
    dailyLogs.forEach((log) => {
      const teamId = projectToTeamMap[log.projectId];
      if (!teamId) return;
      teamActiveDaysMap[teamId]?.add(log.date.toISOString().split('T')[0]);
    });

    // ── Project lifecycle state (milestones, work packages, flags) per team ─
    const teamLogStates: Record<string, ProjectLogState[]> = {};
    teams.forEach((t) => (teamLogStates[t.id] = []));
    projectLogs.forEach((pl) => {
      const teamId = projectToTeamMap[pl.projectId];
      const parsed = safeParseLogState(pl.state);
      if (teamId && parsed) teamLogStates[teamId]?.push(parsed);
    });

    // ── Evaluation reports per team ─────────────────────────────────────────
    const teamEvalReports: Record<string, EvaluationReportContent[]> = {};
    teams.forEach((t) => (teamEvalReports[t.id] = []));
    evaluationReports.forEach((er) => {
      const teamId = projectToTeamMap[er.projectId];
      const parsed = safeParseEvalContent(er.content);
      if (teamId && parsed) teamEvalReports[teamId]?.push(parsed);
    });

    // ── GitHub repos per team ───────────────────────────────────────────────
    const teamGithub: Record<string, { commitCount: number; contributors: { username: string; contributions: number }[] }[]> = {};
    teams.forEach((t) => (teamGithub[t.id] = []));
    githubRepos.forEach((repo) => {
      const teamId = repo.projectId ? projectToTeamMap[repo.projectId] : undefined;
      if (teamId) teamGithub[teamId]?.push(repo);
    });

    // ── Compute per-team ─────────────────────────────────────────────────────
    const raw = teams.map((team) => {
      const agg = teamTasksAgg[team.id];
      const activeLogDays = teamActiveDaysMap[team.id]?.size || 0;
      const startDate = teamProjectDates[team.id] || team.createdAt;
      const expectedLogDays = countWeekdays(startDate);
      const logStates = teamLogStates[team.id] || [];
      const evalReports = teamEvalReports[team.id] || [];
      const githubRepoList = teamGithub[team.id] || [];
      const memberCount = teamMemberCount[team.id] || 0;

      // Execution: task deadline/finishment blended with milestone hit-rate + work-package completion
      const taskFinishment = agg.totalTasks > 0 ? agg.completedTasks / agg.totalTasks : 0;
      const taskDeadlineCompleteness =
        agg.tasksWithDueDate > 0 ? agg.onTimeCompletedTasks / agg.tasksWithDueDate : taskFinishment;

      let milestoneDone = 0;
      let milestoneDecided = 0;
      let workPackageDone = 0;
      let workPackageTotal = 0;
      logStates.forEach((state) => {
        (state.milestones || []).forEach((m) => {
          if (m.status === 'DONE' || m.status === 'MISSED') {
            milestoneDecided += 1;
            if (m.status === 'DONE') milestoneDone += 1;
          }
        });
        (state.workPackages || []).forEach((wp) => {
          workPackageTotal += 1;
          if (wp.status === 'DONE') workPackageDone += 1;
        });
      });
      const milestoneRate = milestoneDecided > 0 ? milestoneDone / milestoneDecided : null;
      const workPackageRate = workPackageTotal > 0 ? workPackageDone / workPackageTotal : null;

      const deadlineCompleteness = clamp01(
        milestoneRate !== null ? (taskDeadlineCompleteness + milestoneRate) / 2 : taskDeadlineCompleteness,
      );
      const finishment = clamp01(
        workPackageRate !== null ? (taskFinishment + workPackageRate) / 2 : taskFinishment,
      );
      const execution = clamp01((deadlineCompleteness + finishment) / 2);

      // Productivity: daily-log activity blended with GitHub commit volume
      const logActivity = clamp01(activeLogDays / expectedLogDays);
      const totalCommits = githubRepoList.reduce((sum, r) => sum + (r.commitCount || 0), 0);
      const githubLinked = githubRepoList.length > 0;
      const githubActivity = githubLinked ? clamp01(totalCommits / COMMIT_CEILING) : null;
      const productivity = clamp01(githubActivity !== null ? (logActivity + githubActivity) / 2 : logActivity);

      // Quality/Authenticity: averaged AI evaluation scores across cycles, gated by plagiarism risk
      let quality = 0;
      let plagiarismRisk: 'LOW' | 'MEDIUM' | 'HIGH' | null = null;
      if (evalReports.length > 0) {
        const sums = evalReports.reduce(
          (acc, r) => {
            acc.scope += r.scopeAdherence?.score || 0;
            acc.technical += r.technicalProgress?.score || 0;
            acc.timeline += r.timelineCompliance?.score || 0;
            acc.docs += r.documentationQuality?.score || 0;
            acc.authenticity += r.authenticityConfidence?.score || 0;
            return acc;
          },
          { scope: 0, technical: 0, timeline: 0, docs: 0, authenticity: 0 },
        );
        const n = evalReports.length;
        const avgOf100 = (sums.scope + sums.technical + sums.timeline + sums.docs + sums.authenticity) / (5 * n);
        quality = clamp01(avgOf100 / 100);
        plagiarismRisk = evalReports[0].plagiarismRisk || null; // most-recent cycle (pre-sorted desc)
        if (plagiarismRisk === 'HIGH') quality *= 0.5;
        else if (plagiarismRisk === 'MEDIUM') quality *= 0.85;
      }

      // Collaboration: contributor balance + work-package assignment coverage + unresolved risk flags
      let contributorBalance = 0.5; // neutral when unknown
      if (githubLinked && memberCount > 0) {
        const activeContributors = githubRepoList.reduce((sum, r) => sum + r.contributors.filter((c) => c.contributions > 0).length, 0);
        contributorBalance = clamp01(activeContributors / memberCount);
      }
      const workPackageCoverage = workPackageTotal > 0 ? clamp01(workPackageTotal / Math.max(1, memberCount)) : 0.5;
      let unresolvedFlagPenalty = 0;
      logStates.forEach((state) => {
        unresolvedFlagPenalty += (state.flags || []).filter((f) => !f.resolved).length;
      });
      const flagFactor = clamp01(1 - unresolvedFlagPenalty / Math.max(1, memberCount * 2));
      const collaboration = clamp01((contributorBalance + workPackageCoverage + flagFactor) / 3);

      const categories: CategoryBreakdown = {
        execution: Number(execution.toFixed(2)),
        productivity: Number(productivity.toFixed(2)),
        quality: Number(quality.toFixed(2)),
        collaboration: Number(collaboration.toFixed(2)),
      };
      const hasActivity =
        agg.totalTasks > 0 ||
        activeLogDays > 0 ||
        workPackageTotal > 0 ||
        evalReports.length > 0 ||
        githubLinked;

      const rawScore =
        execution * EXECUTION_W * 100 +
        productivity * PRODUCTIVITY_W * 100 +
        quality * QUALITY_W * 100 +
        collaboration * COLLABORATION_W * 100;
      const score = hasActivity ? Math.round(rawScore) : 0;

      return {
        teamId: team.id,
        teamName: team.name,
        domain: team.domain,
        score,
        rank: 0,
        deadlineCompleteness: Number(deadlineCompleteness.toFixed(2)),
        finishment: Number(finishment.toFixed(2)),
        productivity: categories.productivity,
        categories,
        githubLinked,
        plagiarismRisk,
        hasActivity,
      };
    });

    raw.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.finishment !== a.finishment) return b.finishment - a.finishment;
      return a.teamName.localeCompare(b.teamName);
    });
    raw.forEach((r, idx) => (r.rank = idx + 1));

    const withDomainRank = assignDomainRanks(raw);

    return withDomainRank.map(({ teamName, ...res }) => res);
  }

  /**
   * Compute live student performance rankings across an organization.
   * Individual attribution: own assigned Task rows, own DailyWorkLog rows,
   * own work-package assignment in ProjectLog, own memberParticipation score
   * in EvaluationReport cycles, own GitHub contribution share (if githubUsername linked).
   */
  static async getStudentRankings(organizationId?: string): Promise<StudentRankingResult[]> {
    const whereOrg = organizationId ? { organizationId, role: 'STUDENT' as const } : { role: 'STUDENT' as const };

    const students = await prisma.user.findMany({
      where: whereOrg,
      select: {
        id: true,
        fullName: true,
        ssgDomain: true,
        githubUsername: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            domain: true,
            createdAt: true,
            projects: { where: { isTemplate: false }, select: { id: true, createdAt: true } },
          },
        },
      },
    });

    if (!students.length) return [];

    const studentIds = students.map((s) => s.id);
    const allProjectIds = Array.from(
      new Set(students.flatMap((s) => (s.team?.projects || []).map((p) => p.id))),
    );

    const [tasks, dailyLogs, projectLogs, evaluationReports, githubRepos] = await Promise.all([
      prisma.task.findMany({
        where: { assigneeId: { in: studentIds } },
        select: { id: true, assigneeId: true, status: true, dueDate: true, completedAt: true },
      }),
      prisma.dailyWorkLog.findMany({
        where: { userId: { in: studentIds } },
        select: { userId: true, date: true },
      }),
      allProjectIds.length
        ? prisma.projectLog.findMany({
            where: { projectId: { in: allProjectIds } },
            select: { projectId: true, state: true },
          })
        : Promise.resolve([]),
      allProjectIds.length
        ? prisma.evaluationReport.findMany({
            where: { projectId: { in: allProjectIds } },
            select: { projectId: true, content: true, periodEnd: true },
            orderBy: { periodEnd: 'desc' },
          })
        : Promise.resolve([]),
      allProjectIds.length
        ? prisma.githubRepository.findMany({
            where: { projectId: { in: allProjectIds } },
            select: {
              projectId: true,
              commitCount: true,
              contributors: { select: { username: true, contributions: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    // ── Task aggregation per student ────────────────────────────────────────
    const studentTasksAgg: Record<
      string,
      { totalTasks: number; completedTasks: number; tasksWithDueDate: number; onTimeCompletedTasks: number }
    > = {};
    students.forEach((s) => (studentTasksAgg[s.id] = { totalTasks: 0, completedTasks: 0, tasksWithDueDate: 0, onTimeCompletedTasks: 0 }));
    tasks.forEach((t) => {
      if (!t.assigneeId || !studentTasksAgg[t.assigneeId]) return;
      const agg = studentTasksAgg[t.assigneeId];
      agg.totalTasks += 1;
      const isCompleted = t.status === 'completed' || t.status === 'done' || !!t.completedAt;
      if (isCompleted) agg.completedTasks += 1;
      if (t.dueDate) {
        agg.tasksWithDueDate += 1;
        if (isCompleted) {
          const compDate = t.completedAt || new Date();
          if (compDate <= t.dueDate) agg.onTimeCompletedTasks += 1;
        }
      }
    });

    // ── Active daily-log days per student ───────────────────────────────────
    const studentActiveDaysMap: Record<string, Set<string>> = {};
    students.forEach((s) => (studentActiveDaysMap[s.id] = new Set<string>()));
    dailyLogs.forEach((log) => {
      studentActiveDaysMap[log.userId]?.add(log.date.toISOString().split('T')[0]);
    });

    // ── Project log states keyed by projectId (for work packages / skill gaps) ─
    const logStateByProject: Record<string, ProjectLogState> = {};
    projectLogs.forEach((pl) => {
      const parsed = safeParseLogState(pl.state);
      if (parsed) logStateByProject[pl.projectId] = parsed;
    });

    // ── Evaluation reports grouped by projectId ─────────────────────────────
    const evalReportsByProject: Record<string, EvaluationReportContent[]> = {};
    evaluationReports.forEach((er) => {
      const parsed = safeParseEvalContent(er.content);
      if (parsed) (evalReportsByProject[er.projectId] ||= []).push(parsed);
    });

    // ── GitHub repos grouped by projectId ───────────────────────────────────
    const githubByProject: Record<string, { commitCount: number; contributors: { username: string; contributions: number }[] }> = {};
    githubRepos.forEach((repo) => {
      if (repo.projectId) githubByProject[repo.projectId] = repo;
    });

    // ── Compute per-student ──────────────────────────────────────────────────
    const raw = students.map((student) => {
      const agg = studentTasksAgg[student.id];
      const activeLogDays = studentActiveDaysMap[student.id]?.size || 0;
      const startDate = student.team?.projects[0]?.createdAt || student.team?.createdAt || student.createdAt;
      const expectedLogDays = countWeekdays(startDate);
      const projectIds = (student.team?.projects || []).map((p) => p.id);

      const taskFinishment = agg.totalTasks > 0 ? agg.completedTasks / agg.totalTasks : 0;
      const taskDeadlineCompleteness =
        agg.tasksWithDueDate > 0 ? agg.onTimeCompletedTasks / agg.tasksWithDueDate : taskFinishment;

      // Own work-package assignment completion across their team's project(s)
      let ownWpDone = 0;
      let ownWpTotal = 0;
      let inSkillGap = false;
      projectIds.forEach((pid) => {
        const state = logStateByProject[pid];
        if (!state) return;
        (state.workPackages || []).forEach((wp) => {
          if (wp.assignedTo?.includes(student.id)) {
            ownWpTotal += 1;
            if (wp.status === 'DONE') ownWpDone += 1;
          }
        });
        (state.skills?.gaps || []).forEach((g) => {
          if (g.missingFor?.includes(student.id)) inSkillGap = true;
        });
      });
      const ownWpRate = ownWpTotal > 0 ? ownWpDone / ownWpTotal : null;

      const deadlineCompleteness = clamp01(taskDeadlineCompleteness);
      const finishment = clamp01(ownWpRate !== null ? (taskFinishment + ownWpRate) / 2 : taskFinishment);
      const execution = clamp01((deadlineCompleteness + finishment) / 2);

      // Own GitHub contribution share within their team's linked repo
      let githubLinked = false;
      let githubShare: number | null = null;
      if (student.githubUsername) {
        for (const pid of projectIds) {
          const repo = githubByProject[pid];
          if (!repo) continue;
          const totalContrib = repo.contributors.reduce((sum, c) => sum + c.contributions, 0);
          const mine = repo.contributors.find(
            (c) => c.username.toLowerCase() === student.githubUsername!.toLowerCase(),
          );
          if (mine) {
            githubLinked = true;
            githubShare = totalContrib > 0 ? clamp01(mine.contributions / totalContrib) : 0;
          }
          break;
        }
      }
      const logActivity = clamp01(activeLogDays / expectedLogDays);
      const productivity = clamp01(githubShare !== null ? (logActivity + githubShare) / 2 : logActivity);

      // Quality: own memberParticipation score across cycles, falls back to team aggregate quality
      let quality = 0;
      let ownScoreFound = false;
      const teamEvalReports = projectIds.flatMap((pid) => evalReportsByProject[pid] || []);
      if (teamEvalReports.length > 0) {
        const ownScores: number[] = [];
        teamEvalReports.forEach((r) => {
          const mine = r.memberParticipation?.perMember?.find((m) => m.userId === student.id);
          if (mine) ownScores.push(mine.score);
        });
        if (ownScores.length > 0) {
          quality = clamp01(ownScores.reduce((a, b) => a + b, 0) / ownScores.length / 100);
          ownScoreFound = true;
        } else {
          // fall back to team-level aggregate quality when no personal grading exists yet
          const sums = teamEvalReports.reduce(
            (acc, r) => {
              acc.scope += r.scopeAdherence?.score || 0;
              acc.technical += r.technicalProgress?.score || 0;
              acc.docs += r.documentationQuality?.score || 0;
              return acc;
            },
            { scope: 0, technical: 0, docs: 0 },
          );
          const n = teamEvalReports.length;
          quality = clamp01((sums.scope + sums.technical + sums.docs) / (3 * n) / 100);
        }
        const latestRisk = teamEvalReports[0]?.plagiarismRisk;
        if (latestRisk === 'HIGH') quality *= 0.5;
        else if (latestRisk === 'MEDIUM') quality *= 0.85;
      }

      // Collaboration: absence from unresolved skill gaps (lightweight individual proxy)
      const collaboration = clamp01(inSkillGap ? 0.4 : 1);

      const categories: CategoryBreakdown = {
        execution: Number(execution.toFixed(2)),
        productivity: Number(productivity.toFixed(2)),
        quality: Number(quality.toFixed(2)),
        collaboration: Number(collaboration.toFixed(2)),
      };
      const hasActivity =
        agg.totalTasks > 0 || activeLogDays > 0 || ownWpTotal > 0 || ownScoreFound || githubLinked;

      const rawScore =
        execution * EXECUTION_W * 100 +
        productivity * PRODUCTIVITY_W * 100 +
        quality * QUALITY_W * 100 +
        collaboration * COLLABORATION_W * 100;
      const score = hasActivity ? Math.round(rawScore) : 0;

      return {
        userId: student.id,
        fullName: student.fullName,
        domain: student.ssgDomain || student.team?.domain || null,
        score,
        rank: 0,
        deadlineCompleteness: Number(deadlineCompleteness.toFixed(2)),
        finishment: Number(finishment.toFixed(2)),
        productivity: categories.productivity,
        categories,
        githubLinked,
        hasActivity,
      };
    });

    raw.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.finishment !== a.finishment) return b.finishment - a.finishment;
      return a.fullName.localeCompare(b.fullName);
    });
    raw.forEach((r, idx) => (r.rank = idx + 1));

    const withDomainRank = assignDomainRanks(raw);

    return withDomainRank.map(({ fullName, ...res }) => res);
  }

  static async getTeamRanking(teamId: string): Promise<TeamRankingResult | null> {
    const all = await this.getTeamRankings();
    return all.find((t) => t.teamId === teamId) || null;
  }

  static async getStudentRanking(userId: string): Promise<StudentRankingResult | null> {
    const all = await this.getStudentRankings();
    return all.find((s) => s.userId === userId) || null;
  }
}
