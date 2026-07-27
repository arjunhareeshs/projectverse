import { prisma } from '../../shared/database';
import { DailyLogEntry } from '../../shared/projectLog.types';

export class DailyLogService {
  async upsertDailyLog(
    projectId: string,
    userId: string,
    data: {
      date?: string;
      workDone: string;
      hoursSpent?: number;
      blockers?: string;
      evidenceUrls?: string[];
    },
  ): Promise<DailyLogEntry> {
    const targetDateStr = data.date || new Date().toISOString().split('T')[0];
    const targetDate = new Date(targetDateStr);

    // Enforce 2-day edit restriction
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetMidnight = new Date(targetDate);
    targetMidnight.setHours(0, 0, 0, 0);

    const diffDays = (today.getTime() - targetMidnight.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 2) {
      throw new Error('Daily work log entries older than 2 days cannot be modified.');
    }

    const record = await prisma.dailyWorkLog.upsert({
      where: {
        projectId_userId_date: {
          projectId,
          userId,
          date: targetDate,
        },
      },
      create: {
        projectId,
        userId,
        date: targetDate,
        workDone: data.workDone,
        hoursSpent: data.hoursSpent,
        blockers: data.blockers,
        evidenceUrls: data.evidenceUrls ? (data.evidenceUrls as any) : undefined,
      },
      update: {
        workDone: data.workDone,
        hoursSpent: data.hoursSpent,
        blockers: data.blockers,
        evidenceUrls: data.evidenceUrls ? (data.evidenceUrls as any) : undefined,
      },
    });

    return {
      id: record.id,
      projectId: record.projectId,
      userId: record.userId,
      date: record.date.toISOString().split('T')[0],
      workDone: record.workDone,
      hoursSpent: record.hoursSpent || undefined,
      blockers: record.blockers || undefined,
      evidenceUrls: (record.evidenceUrls as string[]) || undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async getDailyLogs(
    projectId: string,
    opts: { from?: string; to?: string; userId?: string } = {},
  ): Promise<DailyLogEntry[]> {
    const whereClause: any = { projectId };
    if (opts.userId) {
      whereClause.userId = opts.userId;
    }
    if (opts.from || opts.to) {
      whereClause.date = {};
      if (opts.from) whereClause.date.gte = new Date(opts.from);
      if (opts.to) whereClause.date.lte = new Date(opts.to);
    }

    const rows = await prisma.dailyWorkLog.findMany({
      where: whereClause,
      orderBy: [{ date: 'desc' }, { userId: 'asc' }],
    });

    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      userId: r.userId,
      date: r.date.toISOString().split('T')[0],
      workDone: r.workDone,
      hoursSpent: r.hoursSpent || undefined,
      blockers: r.blockers || undefined,
      evidenceUrls: (r.evidenceUrls as string[]) || undefined,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
}

export const dailyLogService = new DailyLogService();
