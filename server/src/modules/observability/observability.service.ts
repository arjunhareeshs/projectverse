import { prisma } from '../../shared/database';

interface TsRow {
  ts: Date;
  requests: bigint;
  serverErrors: bigint;
  clientErrors: bigint;
  avgMs: number | null;
  p95Ms: number | null;
  activeUsers: bigint;
}

function since(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export class ObservabilityService {
  /** Request volume/latency/error-rate overview for the API. */
  async getRequestOverview(days = 1) {
    const from = since(days);

    const [totals, errorCount, slowest] = await Promise.all([
      prisma.requestLog.aggregate({
        where: { createdAt: { gte: from } },
        _count: { _all: true },
        _avg: { durationMs: true },
      }),
      prisma.requestLog.count({
        where: { createdAt: { gte: from }, statusCode: { gte: 500 } },
      }),
      prisma.requestLog.findMany({
        where: { createdAt: { gte: from } },
        orderBy: { durationMs: 'desc' },
        take: 10,
      }),
    ]);

    return {
      windowDays: days,
      totalRequests: totals._count._all,
      avgLatencyMs: Math.round(totals._avg.durationMs || 0),
      serverErrorCount: errorCount,
      slowestRequests: slowest,
    };
  }

  /** Per-route breakdown: volume, avg latency, error rate — the "which endpoint is hurting" view. */
  async getRequestsByRoute(days = 1) {
    const from = since(days);
    const grouped = await prisma.requestLog.groupBy({
      by: ['path', 'method'],
      where: { createdAt: { gte: from } },
      _count: { _all: true },
      _avg: { durationMs: true },
      orderBy: { _count: { path: 'desc' } },
      take: 50,
    });

    const errorRows = await prisma.requestLog.groupBy({
      by: ['path', 'method'],
      where: { createdAt: { gte: from }, statusCode: { gte: 400 } },
      _count: { _all: true },
    });
    const errorMap = new Map(errorRows.map((e) => [`${e.method} ${e.path}`, e._count._all]));

    return grouped.map((g) => ({
      method: g.method,
      path: g.path,
      requests: g._count._all,
      avgLatencyMs: Math.round(g._avg.durationMs || 0),
      errorCount: errorMap.get(`${g.method} ${g.path}`) || 0,
    }));
  }

  async getRecentRequests(limit = 100) {
    return prisma.requestLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  /** Latest + recent history of process/host load for a trend view. */
  async getMetrics(hours = 6, instance?: string) {
    const from = new Date(Date.now() - hours * 60 * 60 * 1000);
    const instances = (
      await prisma.systemMetricSnapshot.findMany({
        where: { createdAt: { gte: from } },
        distinct: ['instance'],
        select: { instance: true },
        orderBy: { instance: 'asc' },
      })
    ).map((r) => r.instance);

    // Each replica reports its own series; mixing them would make one jagged line.
    const selected = instance && instances.includes(instance) ? instance : instances[0];
    const rows = selected
      ? await prisma.systemMetricSnapshot.findMany({
          where: { createdAt: { gte: from }, instance: selected },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    return {
      instances,
      instance: selected ?? null,
      latest: rows[rows.length - 1] || null,
      history: rows,
    };
  }

  /** Requests, error counts and latency percentiles per time bucket. */
  async getRequestTimeseries(hours = 24) {
    const from = new Date(Date.now() - hours * 60 * 60 * 1000);
    // Up to 48h: 10-minute buckets; beyond that: hourly buckets.
    const rows =
      hours > 48
        ? await prisma.$queryRaw<TsRow[]>`
            SELECT date_trunc('hour', "createdAt") AS ts,
                   COUNT(*)::bigint AS requests,
                   COUNT(*) FILTER (WHERE "statusCode" >= 500)::bigint AS "serverErrors",
                   COUNT(*) FILTER (WHERE "statusCode" >= 400 AND "statusCode" < 500)::bigint AS "clientErrors",
                   AVG("durationMs")::float AS "avgMs",
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::float AS "p95Ms",
                   COUNT(DISTINCT "userId")::bigint AS "activeUsers"
            FROM "RequestLog" WHERE "createdAt" >= ${from}
            GROUP BY ts ORDER BY ts ASC`
        : await prisma.$queryRaw<TsRow[]>`
            SELECT to_timestamp(floor(extract(epoch FROM "createdAt") / 600) * 600) AS ts,
                   COUNT(*)::bigint AS requests,
                   COUNT(*) FILTER (WHERE "statusCode" >= 500)::bigint AS "serverErrors",
                   COUNT(*) FILTER (WHERE "statusCode" >= 400 AND "statusCode" < 500)::bigint AS "clientErrors",
                   AVG("durationMs")::float AS "avgMs",
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::float AS "p95Ms",
                   COUNT(DISTINCT "userId")::bigint AS "activeUsers"
            FROM "RequestLog" WHERE "createdAt" >= ${from}
            GROUP BY ts ORDER BY ts ASC`;

    return rows.map((r) => ({
      ts: r.ts,
      requests: Number(r.requests),
      serverErrors: Number(r.serverErrors),
      clientErrors: Number(r.clientErrors),
      avgMs: Math.round(r.avgMs || 0),
      p95Ms: Math.round(r.p95Ms || 0),
      activeUsers: Number(r.activeUsers),
    }));
  }

  /** Share of responses by status class (2xx/3xx/4xx/5xx). */
  async getStatusDistribution(days = 1) {
    const from = since(days);
    const rows = await prisma.$queryRaw<{ cls: string; count: bigint }[]>`
      SELECT (("statusCode" / 100)::int::text || 'xx') AS cls, COUNT(*)::bigint AS count
      FROM "RequestLog" WHERE "createdAt" >= ${from}
      GROUP BY cls ORDER BY cls ASC`;
    return rows.map((r) => ({ name: r.cls, value: Number(r.count) }));
  }

  /** Backend (SystemLog ERROR/WARN) and browser error counts per hour. */
  async getErrorTimeseries(days = 1) {
    const from = since(days);
    const [backend, client] = await Promise.all([
      prisma.$queryRaw<{ ts: Date; errors: bigint; warnings: bigint }[]>`
        SELECT date_trunc('hour', "createdAt") AS ts,
               COUNT(*) FILTER (WHERE level = 'ERROR')::bigint AS errors,
               COUNT(*) FILTER (WHERE level = 'WARN')::bigint AS warnings
        FROM "SystemLog" WHERE "createdAt" >= ${from} AND level IN ('ERROR','WARN')
        GROUP BY ts ORDER BY ts ASC`,
      prisma.$queryRaw<{ ts: Date; errors: bigint }[]>`
        SELECT date_trunc('hour', "createdAt") AS ts, COUNT(*)::bigint AS errors
        FROM "ClientErrorLog" WHERE "createdAt" >= ${from}
        GROUP BY ts ORDER BY ts ASC`,
    ]);

    const merged = new Map<string, { ts: Date; backendErrors: number; backendWarnings: number; browserErrors: number }>();
    const slot = (ts: Date) => {
      const k = ts.toISOString();
      if (!merged.has(k)) merged.set(k, { ts, backendErrors: 0, backendWarnings: 0, browserErrors: 0 });
      return merged.get(k)!;
    };
    backend.forEach((r) => {
      const s = slot(r.ts);
      s.backendErrors = Number(r.errors);
      s.backendWarnings = Number(r.warnings);
    });
    client.forEach((r) => {
      slot(r.ts).browserErrors = Number(r.errors);
    });
    return [...merged.values()].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  }

  async getBackendErrors(limit = 100) {
    return prisma.systemLog.findMany({
      where: { level: 'ERROR' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getClientErrors(limit = 100) {
    return prisma.clientErrorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const observabilityService = new ObservabilityService();
