import cron from 'node-cron';
import { prisma } from '../../shared/database';
import { logger } from '../../shared/logger';
import { withLock } from '../../shared/redis';

const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY_MS);

/** Deletes old observability rows so the monitoring tables don't grow without bound. */
export async function runRetention() {
  const [requests, logs, metrics, clientErrors, aiUsage] = await Promise.all([
    prisma.requestLog.deleteMany({ where: { createdAt: { lt: ago(14) } } }),
    prisma.systemLog.deleteMany({ where: { createdAt: { lt: ago(14) } } }),
    prisma.systemMetricSnapshot.deleteMany({ where: { createdAt: { lt: ago(90) } } }),
    prisma.clientErrorLog.deleteMany({ where: { createdAt: { lt: ago(90) } } }),
    prisma.aIUsageLog.deleteMany({ where: { createdAt: { lt: ago(90) } } }),
  ]);
  return {
    requestLogs: requests.count,
    systemLogs: logs.count,
    metricSnapshots: metrics.count,
    clientErrors: clientErrors.count,
    aiUsageLogs: aiUsage.count,
  };
}

export function startRetentionScheduler() {
  // Daily at 00:30, before the 01:00 evaluation run.
  cron.schedule('30 0 * * *', () =>
    withLock('cron:observability-retention', 30 * 60_000, async () => {
      try {
        logger.info('[Retention] Pruned observability data', await runRetention());
      } catch (err: any) {
        logger.error(`[Retention] Failed: ${err.message}`, { source: 'observability.retention' });
      }
    }),
  );
  logger.info('[Retention] Scheduled daily observability cleanup (00:30)');
}
