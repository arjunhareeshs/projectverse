import { prisma } from '../../shared/database';

export interface DailyLogDraft {
  workDone: string;
  evidenceUrls: string[];
  source: 'github' | 'none';
}

function startOfDay(d: Date): Date {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  return res;
}

function endOfDay(d: Date): Date {
  const res = new Date(d);
  res.setHours(23, 59, 59, 999);
  return res;
}

/**
 * Drafts a daily work log pre-filled from that day's GitHub commits for the requesting user.
 * Student confirms or edits before saving (H1).
 */
export async function draftDailyLog(
  projectId: string,
  userId: string,
  targetDate: Date = new Date()
): Promise<DailyLogDraft> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { githubUsername: true },
  });

  if (!user?.githubUsername) {
    return { workDone: '', evidenceUrls: [], source: 'none' };
  }

  const repo = await prisma.githubRepository.findUnique({
    where: { projectId },
    select: { id: true },
  });

  if (!repo) {
    return { workDone: '', evidenceUrls: [], source: 'none' };
  }

  const ghUserLower = user.githubUsername.toLowerCase();

  const dayCommits = await prisma.githubCommit.findMany({
    where: {
      repositoryId: repo.id,
      date: {
        gte: startOfDay(targetDate),
        lte: endOfDay(targetDate),
      },
    },
    select: { message: true, sha: true, author: true },
  });

  const userCommits = dayCommits.filter(
    (c) => c.author && c.author.toLowerCase() === ghUserLower
  );

  if (userCommits.length === 0) {
    return { workDone: '', evidenceUrls: [], source: 'none' };
  }

  const bulletList = userCommits
    .map((c) => `- ${c.message.split('\n')[0].trim()}`)
    .join('\n');

  const evidenceUrls = userCommits.map((c) => c.sha);

  return {
    workDone: bulletList,
    evidenceUrls,
    source: 'github',
  };
}
