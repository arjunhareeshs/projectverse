import os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { prisma } from '../../shared/database';

const SNAPSHOT_INTERVAL_MS = 60_000;

/**
 * Periodically snapshots process/host load so the dashboard can show a trend,
 * not just an instantaneous reading. Mirrors what a Prometheus node-exporter
 * would scrape, but written straight to Postgres since we have no metrics
 * backend here.
 */
export function startMetricsCollector() {
  const eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
  eventLoopMonitor.enable();

  setInterval(() => {
    const memoryTotalMb = Math.round(os.totalmem() / 1024 / 1024);
    const memoryUsedMb = memoryTotalMb - Math.round(os.freemem() / 1024 / 1024);
    const processRssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const eventLoopLagMs = eventLoopMonitor.mean / 1_000_000;

    prisma.systemMetricSnapshot
      .create({
        data: {
          instance: os.hostname(),
          cpuLoadAvg1m: os.loadavg()[0],
          memoryUsedMb,
          memoryTotalMb,
          processRssMb,
          eventLoopLagMs: Number.isFinite(eventLoopLagMs) ? eventLoopLagMs : 0,
          uptimeSec: Math.round(process.uptime()),
        },
      })
      .catch(() => {
        // Metrics collection must never crash the server
      });

    eventLoopMonitor.reset();
  }, SNAPSHOT_INTERVAL_MS);
}
