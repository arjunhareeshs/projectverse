import type { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../shared/database';

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_AT_ROWS = 200;
const MAX_BUFFERED_ROWS = 5_000;

// Probes and the monitoring dashboards' own polling would otherwise dominate the log.
const SKIP_PREFIXES = ['/api/health', '/api/developer/'];

let buffer: Prisma.RequestLogCreateManyInput[] = [];
let flushing = false;

async function flush() {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  const rows = buffer;
  buffer = [];
  try {
    await prisma.requestLog.createMany({ data: rows });
  } catch {
    // Logging must never break the app; drop this batch.
  } finally {
    flushing = false;
  }
}

setInterval(flush, FLUSH_INTERVAL_MS).unref();
process.once('beforeExit', () => void flush());

/** Batched per-request logging: one INSERT per ~5s instead of one per request. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  if (SKIP_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    if (buffer.length >= MAX_BUFFERED_ROWS) return; // DB is behind — shed log rows, not requests
    buffer.push({
      method: req.method,
      path: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(Number(process.hrtime.bigint() - start) / 1_000_000),
      userId: (req as any).user?.id,
      ip: req.ip,
    });
    if (buffer.length >= FLUSH_AT_ROWS) void flush();
  });

  next();
}
