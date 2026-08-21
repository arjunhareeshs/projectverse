import { prisma } from '../../shared/database';
import { projectLogService } from '../lifecycle/projectLog.service';
import { teamWorkload } from './workload';
import type { RiskInput } from './riskModel';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampSigned(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

/**
 * Builds a real RiskInput for a project from its actual lifecycle state,
 * daily logs, GitHub commit history, and task workload — replacing the
 * pattern found in cohortMetrics.earlyWarningBoard, which passed teamRisk()
 * hardcoded constants (percentTimeElapsed: 40, percentMilestonesDone: 30,
 * commitVelocityTrend: 0, openFlagSeverity: 0.2, contributionGini: 0.25) for
 * every project regardless of its real data — only logComplianceRate was
 * genuinely computed, so 75% of the weighted risk score was a shared
 * constant across the whole board.
 *
 * Reads ProjectLog.state (the same source of truth the evaluation engine and
 * lifecycle controller already use) rather than the normalized ProjectLog*
 * child tables, so this stays consistent with the rest of the app even while
 * those tables and the JSON state can drift (see DATABASE_DESIGN.md §13.7 R-4).
 */
export async function buildRiskInputForProject(projectId: string): Promise<RiskInput> {
  const state = await projectLogService.getState(projectId);

  if (!state) {
    // No lifecycle log yet (e.g. a template, or a project that hasn't run
    // intake) — neutral input, not a fabricated risk signal.
    return {
      percentTimeElapsed: 0,
      percentMilestonesDone: 0,
      logComplianceRate: 1,
      commitVelocityTrend: 0,
      openFlagSeverity: 0,
      contributionGini: 0,
    };
  }

  const now = Date.now();
  const start = new Date(state.duration.startDate).getTime();
  const end = new Date(state.duration.endDate).getTime();
  const totalDays = Math.max(1, (end - start) / MS_PER_DAY);
  const percentTimeElapsed = Math.max(0, Math.min(100, ((now - start) / MS_PER_DAY / totalDays) * 100));

  const milestonesTotal = state.milestones.length;
  const milestonesDone = state.milestones.filter((m) => m.status === 'DONE').length;
  const percentMilestonesDone = milestonesTotal > 0 ? (milestonesDone / milestonesTotal) * 100 : 0;

  const activeMembers = Math.max(1, state.team.members.filter((m) => m.active).length);
  const daysElapsed = Math.max(1, Math.min(totalDays, Math.floor((now - start) / MS_PER_DAY)));
  const dailyLogCount = await prisma.dailyWorkLog.count({ where: { projectId } });
  const expectedLogs = Math.max(1, daysElapsed * activeMembers);
  const logComplianceRate = clamp01(dailyLogCount / expectedLogs);

  let commitVelocityTrend = 0;
  const repo = await prisma.githubRepository.findUnique({ where: { projectId }, select: { id: true } });
  if (repo) {
    const sevenDaysAgo = new Date(now - 7 * MS_PER_DAY);
    const fourteenDaysAgo = new Date(now - 14 * MS_PER_DAY);
    const [recentCount, priorCount] = await Promise.all([
      prisma.githubCommit.count({ where: { repositoryId: repo.id, date: { gte: sevenDaysAgo } } }),
      prisma.githubCommit.count({ where: { repositoryId: repo.id, date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    ]);
    if (priorCount === 0 && recentCount > 0) {
      commitVelocityTrend = 1; // went from silence to activity — strongest positive signal
    } else if (priorCount > 0) {
      commitVelocityTrend = clampSigned((recentCount - priorCount) / priorCount);
    }
    // priorCount === 0 && recentCount === 0 stays 0 (no data either window)
  }

  const unresolvedFlags = state.flags.filter((f) => !f.resolved);
  const openFlagSeverity = unresolvedFlags.length > 0
    ? clamp01(unresolvedFlags.reduce((sum, f) => sum + (f.severity ?? 50), 0) / unresolvedFlags.length / 100)
    : 0;

  const workload = await teamWorkload(projectId);
  const contributionGini = workload.imbalanceGini;

  return {
    percentTimeElapsed: Number(percentTimeElapsed.toFixed(1)),
    percentMilestonesDone: Number(percentMilestonesDone.toFixed(1)),
    logComplianceRate: Number(logComplianceRate.toFixed(2)),
    commitVelocityTrend: Number(commitVelocityTrend.toFixed(2)),
    openFlagSeverity: Number(openFlagSeverity.toFixed(2)),
    contributionGini,
  };
}
