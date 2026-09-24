import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database';

function since(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export class AiObservabilityService {
  /** High-level counters for the observability dashboard header. */
  async getOverview(days = 30) {
    const from = since(days);

    const [totals, statusCounts, providerCounts, activeUsers] = await Promise.all([
      prisma.aIUsageLog.aggregate({
        where: { createdAt: { gte: from } },
        _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
        _avg: { latencyMs: true },
        _count: { _all: true },
      }),
      prisma.aIUsageLog.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from } },
        _count: { _all: true },
      }),
      prisma.aIUsageLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: from } },
        _count: { _all: true },
        _sum: { totalTokens: true },
      }),
      prisma.aIUsageLog.findMany({
        where: { createdAt: { gte: from } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    ]);

    return {
      windowDays: days,
      totalRequests: totals._count._all,
      totalInputTokens: totals._sum.inputTokens || 0,
      totalOutputTokens: totals._sum.outputTokens || 0,
      totalTokens: totals._sum.totalTokens || 0,
      avgLatencyMs: Math.round(totals._avg.latencyMs || 0),
      activeAiUsers: activeUsers.length,
      byStatus: statusCounts.map((s) => ({ status: s.status, count: s._count._all })),
      byProvider: providerCounts.map((p) => ({
        provider: p.provider,
        count: p._count._all,
        totalTokens: p._sum.totalTokens || 0,
      })),
    };
  }

  /** Daily token/request totals for a trend chart. */
  async getUsageTimeseries(days = 30, bucket: 'hour' | 'day' = 'day') {
    const from = since(days);
    const unit = Prisma.raw(`'${bucket === 'hour' ? 'hour' : 'day'}'`);
    const rows = await prisma.$queryRaw<
      {
        ts: Date;
        requests: bigint;
        inputTokens: bigint | null;
        outputTokens: bigint | null;
        totalTokens: bigint | null;
        groqTokens: bigint | null;
        nvidiaTokens: bigint | null;
        failures: bigint;
        fallbacks: bigint;
        activeUsers: bigint;
        avgLatencyMs: number | null;
      }[]
    >`
      SELECT date_trunc(${unit}, "createdAt") AS ts,
             COUNT(*)::bigint AS requests,
             SUM("inputTokens")::bigint AS "inputTokens",
             SUM("outputTokens")::bigint AS "outputTokens",
             SUM("totalTokens")::bigint AS "totalTokens",
             SUM("totalTokens") FILTER (WHERE provider = 'GROQ')::bigint AS "groqTokens",
             SUM("totalTokens") FILTER (WHERE provider = 'NVIDIA')::bigint AS "nvidiaTokens",
             COUNT(*) FILTER (WHERE status = 'FAILURE')::bigint AS failures,
             COUNT(*) FILTER (WHERE status = 'FALLBACK')::bigint AS fallbacks,
             COUNT(DISTINCT "userId")::bigint AS "activeUsers",
             AVG("latencyMs")::float AS "avgLatencyMs"
      FROM "AIUsageLog"
      WHERE "createdAt" >= ${from}
      GROUP BY ts
      ORDER BY ts ASC
    `;

    return rows.map((r) => ({
      ts: r.ts,
      requests: Number(r.requests),
      inputTokens: Number(r.inputTokens || 0),
      outputTokens: Number(r.outputTokens || 0),
      totalTokens: Number(r.totalTokens || 0),
      groqTokens: Number(r.groqTokens || 0),
      nvidiaTokens: Number(r.nvidiaTokens || 0),
      failures: Number(r.failures),
      fallbacks: Number(r.fallbacks),
      activeUsers: Number(r.activeUsers),
      avgLatencyMs: Math.round(r.avgLatencyMs || 0),
    }));
  }

  /** Per-user usage breakdown, most active first. */
  async getUsageByUser(days = 30, limit = 50) {
    const from = since(days);
    const grouped = await prisma.aIUsageLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: from } },
      _count: { _all: true },
      _sum: { totalTokens: true, inputTokens: true, outputTokens: true },
      _max: { createdAt: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
      take: limit,
    });

    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, email: true, fullName: true, role: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return grouped.map((g) => ({
      userId: g.userId,
      email: userMap.get(g.userId)?.email || 'unknown',
      fullName: userMap.get(g.userId)?.fullName || 'unknown',
      role: userMap.get(g.userId)?.role || 'unknown',
      requests: g._count._all,
      totalTokens: g._sum.totalTokens || 0,
      inputTokens: g._sum.inputTokens || 0,
      outputTokens: g._sum.outputTokens || 0,
      lastUsedAt: g._max.createdAt,
    }));
  }

  /** Raw recent AI request log rows, most recent first. */
  async getRecentUsageLogs(limit = 100) {
    const logs = await prisma.aIUsageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { email: true, fullName: true, role: true } } },
    });

    return logs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt,
      userEmail: l.user.email,
      userFullName: l.user.fullName,
      provider: l.provider,
      model: l.model,
      status: l.status,
      errorCode: l.errorCode,
      inputTokens: l.inputTokens,
      outputTokens: l.outputTokens,
      totalTokens: l.totalTokens,
      latencyMs: l.latencyMs,
    }));
  }

  /** Structured application logs (warnings/errors) across the system. */
  async getSystemLogs(params: { limit?: number; level?: 'INFO' | 'WARN' | 'ERROR'; source?: string }) {
    const { limit = 200, level, source } = params;
    return prisma.systemLog.findMany({
      where: {
        ...(level ? { level } : {}),
        ...(source ? { source: { contains: source } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Health of user-configured provider keys — who is configured, who is erroring. */
  async getProviderHealth() {
    const providers = await prisma.userAIProvider.findMany({
      select: {
        provider: true,
        isEnabled: true,
        lastUsedAt: true,
        lastErrorCode: true,
        lastErrorAt: true,
        user: { select: { email: true, fullName: true } },
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return providers.map((p) => ({
      provider: p.provider,
      enabled: p.isEnabled,
      userEmail: p.user.email,
      userFullName: p.user.fullName,
      lastUsedAt: p.lastUsedAt,
      lastErrorCode: p.lastErrorCode,
      lastErrorAt: p.lastErrorAt,
    }));
  }
}

export const aiObservabilityService = new AiObservabilityService();
