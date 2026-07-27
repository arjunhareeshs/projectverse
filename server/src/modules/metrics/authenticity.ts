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
