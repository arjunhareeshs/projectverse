import { prisma } from '../../shared/database';
import { notificationService } from '../notifications/notification.service';
import { logger } from '../../shared/logger';

function startOfDay(d: Date = new Date()): Date {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  return res;
}

function endOfDay(d: Date = new Date()): Date {
  const res = new Date(d);
  res.setHours(23, 59, 59, 999);
  return res;
}

/**
 * Sweeps active user streaks and sends a single nudge notification (H5)
 * to users with active streaks who haven't logged today's work yet.
 */
export async function runStreakNudgeSweep(): Promise<{ nudgedCount: number }> {
  try {
    const activeStreaks = await prisma.userStreak.findMany({
      where: {
        currentStreak: { gt: 0 },
      },
      select: {
        userId: true,
        currentStreak: true,
      },
    });

    let nudgedCount = 0;
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    for (const streak of activeStreaks) {
      const loggedToday = await prisma.dailyWorkLog.count({
        where: {
          userId: streak.userId,
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      });

      if (loggedToday === 0) {
        await notificationService.createForUser(
          streak.userId,
          `Keep your ${streak.currentStreak}-day streak!`,
          `Log today's work to keep your ${streak.currentStreak}-day activity streak alive.`
        );
        nudgedCount++;
      }
    }

    logger.info(`Streak nudge sweep completed: ${nudgedCount} users nudged out of ${activeStreaks.length} active streaks.`);
    return { nudgedCount };
  } catch (err: any) {
    logger.error('Error running streak nudge sweep', { message: err.message });
    return { nudgedCount: 0 };
  }
}
