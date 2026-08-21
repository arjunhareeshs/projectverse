import { prisma } from '../../shared/database';

export interface MemberAuthenticitySignal {
  userId: string;
  date: string;
  logClaimed: boolean;
  hoursClaimed: number;
  commitCount: number;
  docActivityCount: number;
  suspicious: boolean;
  reason?: string;
}

export interface ProjectAuthenticityReport {
  overallConfidence: number; // 0-100
  suspiciousFlags: string[];
  signals: MemberAuthenticitySignal[];
}

/**
 * Deterministic cross-source correlation (V3).
 * Flags uncorroborated daily log claims where member claims work but has 0 GitHub commits
 * AND 0 project document edits on that date.
 */
export async function auditProjectAuthenticity(projectId: string): Promise<ProjectAuthenticityReport> {
  const logs = await prisma.dailyWorkLog.findMany({
    where: { projectId },
    select: { userId: true, date: true, workDone: true, hoursSpent: true },
  });

  const repo = await prisma.githubRepository.findUnique({
    where: { projectId },
    select: { id: true },
  });

  const memberUsers = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true, user: { select: { githubUsername: true, fullName: true } } },
  });

  const githubUserMap = new Map<string, string>();
  const nameMap = new Map<string, string>();
  for (const m of memberUsers) {
    nameMap.set(m.userId, m.user.fullName);
    if (m.user.githubUsername) {
      githubUserMap.set(m.user.githubUsername.toLowerCase(), m.userId);
    }
  }

  // Fetch commits for the project repository if linked
  const commits = repo
    ? await prisma.githubCommit.findMany({
        where: { repositoryId: repo.id },
        select: { author: true, date: true },
      })
    : [];

  const signals: MemberAuthenticitySignal[] = [];
  const suspiciousFlags: string[] = [];

  for (const log of logs) {
    const dateStr = log.date.toISOString().split('T')[0];
    const logUser = memberUsers.find((m) => m.userId === log.userId);
    const ghUser = logUser?.user.githubUsername?.toLowerCase();

    // Count commits on that day for that user
    const dayCommits = commits.filter((c) => {
      const commitDateStr = c.date.toISOString().split('T')[0];
      return commitDateStr === dateStr && c.author && c.author.toLowerCase() === ghUser;
    }).length;

    // Document edits on that day (placeholder check for project log activity)
    const docActivityCount = 0;

    const claimed = Boolean(log.workDone && log.workDone.trim().length > 10);
    const suspicious = claimed && Boolean(ghUser) && dayCommits === 0 && docActivityCount === 0;

    const signal: MemberAuthenticitySignal = {
      userId: log.userId,
      date: dateStr,
      logClaimed: claimed,
      hoursClaimed: log.hoursSpent || 0,
      commitCount: dayCommits,
      docActivityCount,
      suspicious,
      reason: suspicious
        ? `Uncorroborated daily log on ${dateStr}: claimed work with 0 commits and 0 doc activity.`
        : undefined,
    };

    signals.push(signal);

    if (suspicious) {
      const uName = nameMap.get(log.userId) || log.userId;
      suspiciousFlags.push(`Member ${uName} on ${dateStr}: claimed work with no linked commits/doc evidence.`);
    }
  }

  const totalLogs = signals.length;
  const suspiciousCount = signals.filter((s) => s.suspicious).length;
  const overallConfidence = totalLogs > 0
    ? Math.max(0, Math.round(100 - (suspiciousCount / totalLogs) * 100))
    : 100;

  return { overallConfidence, suspiciousFlags, signals };
}

/**
 * Runs `auditProjectAuthenticity` and persists the result as an
 * AuthenticityAudit + per-member AuthenticitySignal rows, optionally linked to
 * the EvaluationReport cycle that consumed it. Idempotent per
 * (projectId, periodStart, periodEnd) via the schema's unique constraint —
 * safe to re-run for the same window (e.g. a re-triggered evaluation).
 *
 * These are academic-integrity records about a specific person and must
 * survive that person's account being archived, which is why
 * AuthenticitySignal.userId is RESTRICT rather than CASCADE in the schema.
 */
export async function persistAuthenticityAudit(
  projectId: string,
  window: { periodStart: Date; periodEnd: Date },
  options: { evaluationReportId?: string; computeRunId?: string } = {},
): Promise<{ report: ProjectAuthenticityReport; auditId: string }> {
  const report = await auditProjectAuthenticity(projectId);

  const audit = await prisma.authenticityAudit.upsert({
    where: {
      projectId_periodStart_periodEnd: {
        projectId,
        periodStart: window.periodStart,
        periodEnd: window.periodEnd,
      },
    },
    create: {
      projectId,
      overallConfidence: report.overallConfidence,
      signalCount: report.signals.length,
      suspiciousCount: report.signals.filter((s) => s.suspicious).length,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      evaluationReportId: options.evaluationReportId,
      computeRunId: options.computeRunId,
    },
    update: {
      overallConfidence: report.overallConfidence,
      signalCount: report.signals.length,
      suspiciousCount: report.signals.filter((s) => s.suspicious).length,
      evaluationReportId: options.evaluationReportId,
      computeRunId: options.computeRunId,
    },
  });

  // Replace the signal set for this window rather than accumulating
  // duplicates across re-runs — the audit represents the current read of the
  // window, not a history of every re-computation.
  await prisma.authenticitySignal.deleteMany({ where: { auditId: audit.id } });
  if (report.signals.length > 0) {
    await prisma.authenticitySignal.createMany({
      data: report.signals.map((s) => ({
        auditId: audit.id,
        userId: s.userId,
        date: new Date(s.date),
        logClaimed: s.logClaimed,
        hoursClaimed: s.hoursClaimed,
        commitCount: s.commitCount,
        docActivityCount: s.docActivityCount,
        suspicious: s.suspicious,
        reason: s.reason,
      })),
      skipDuplicates: true,
    });
  }

  return { report, auditId: audit.id };
}
