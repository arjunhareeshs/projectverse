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

export interface EscalationUpsertResult {
  blocker: PersistentBlocker;
  escalationId: string;
  /**
   * True only when this escalation is brand new, or an existing OPEN one just
   * recurred again (recurrenceCount increased). False when the same blocker
   * was already escalated for this exact recurrence count — callers should
   * use this to decide whether to raise a fresh notification/event, so a
   * blocker unchanged since yesterday doesn't re-fire on every daily log
   * submission from any team member (the source of the pre-fix duplicate
   * BLOCKER_ESCALATED event spam).
   */
  isNewOrWorsened: boolean;
}

/**
 * Runs `detectPersistentBlockers` and upserts each result into
 * BlockerEscalation, keyed on (projectId, userId, firstSeenDate) so the same
 * underlying blocker is one row across every daily log submission that
 * re-detects it, not a fresh event each time. A RESOLVED or STALE escalation
 * is left alone — resolution is a human/status decision, not something a
 * later log submission should silently reopen.
 */
export async function persistBlockerEscalations(projectId: string): Promise<EscalationUpsertResult[]> {
  const detected = await detectPersistentBlockers(projectId);
  const results: EscalationUpsertResult[] = [];

  for (const blocker of detected) {
    const existing = await prisma.blockerEscalation.findUnique({
      where: {
        projectId_userId_firstSeenDate: {
          projectId,
          userId: blocker.userId,
          firstSeenDate: new Date(blocker.firstSeenDate),
        },
      },
    });

    if (existing && existing.status !== 'OPEN' && existing.status !== 'ACKNOWLEDGED') {
      // Already RESOLVED or STALE — a re-detection of the same text/window
      // must not silently reopen a closed escalation.
      continue;
    }

    if (existing) {
      const worsened = blocker.recurrenceCount > existing.recurrenceCount;
      const updated = await prisma.blockerEscalation.update({
        where: { id: existing.id },
        data: {
          lastSeenDate: new Date(blocker.lastSeenDate),
          recurrenceCount: blocker.recurrenceCount,
          severity: blocker.severity,
        },
      });
      results.push({ blocker, escalationId: updated.id, isNewOrWorsened: worsened });
    } else {
      const created = await prisma.blockerEscalation.create({
        data: {
          projectId,
          userId: blocker.userId,
          summary: blocker.summary,
          firstSeenDate: new Date(blocker.firstSeenDate),
          lastSeenDate: new Date(blocker.lastSeenDate),
          recurrenceCount: blocker.recurrenceCount,
          severity: blocker.severity,
        },
      });
      results.push({ blocker, escalationId: created.id, isNewOrWorsened: true });
    }
  }

  return results;
}
