import { prisma } from '../../shared/database';
import { wordOverlapRatio } from '../../shared/stringUtils';

export const ESCALATION_DAYS = 3;

export interface PersistentBlocker {
  userId: string;
  summary: string;
  firstSeenDate: string;
  lastSeenDate: string;
  recurrenceCount: number;
  severity: number; // 0-100
}

/**
 * Scans a project's daily work logs to identify persistent, unresolved blockers
 * that have recurred across >= ESCALATION_DAYS without resolution.
 */
export async function detectPersistentBlockers(projectId: string): Promise<PersistentBlocker[]> {
  const logs = await prisma.dailyWorkLog.findMany({
    where: {
      projectId,
      blockers: { not: null },
    },
    orderBy: { date: 'asc' },
    select: {
      userId: true,
      date: true,
      blockers: true,
    },
  });

  const validLogs = logs.filter(
    (l) => l.blockers && l.blockers.trim().length > 0 && l.blockers.trim().toLowerCase() !== 'none'
  );

  if (validLogs.length === 0) return [];

  // Group similar blockers using word overlap ratio per user
  const blockerGroups: Array<{
    userId: string;
    text: string;
    dates: string[];
  }> = [];

  for (const log of validLogs) {
    const text = log.blockers!.trim();
    const dateStr = log.date.toISOString().split('T')[0];

    const existingGroup = blockerGroups.find(
      (g) => g.userId === log.userId && wordOverlapRatio(g.text, text) > 0.4
    );

    if (existingGroup) {
      if (!existingGroup.dates.includes(dateStr)) {
        existingGroup.dates.push(dateStr);
      }
    } else {
      blockerGroups.push({
        userId: log.userId,
        text,
        dates: [dateStr],
      });
    }
  }

  const persistent: PersistentBlocker[] = [];

  for (const group of blockerGroups) {
    if (group.dates.length >= ESCALATION_DAYS) {
      const sortedDates = [...group.dates].sort();
      const recurrenceCount = sortedDates.length;
      const severity = Math.min(100, Math.round(50 + recurrenceCount * 15));

      persistent.push({
        userId: group.userId,
        summary: group.text,
        firstSeenDate: sortedDates[0],
        lastSeenDate: sortedDates[sortedDates.length - 1],
        recurrenceCount,
        severity,
      });
    }
  }

  return persistent;
}
