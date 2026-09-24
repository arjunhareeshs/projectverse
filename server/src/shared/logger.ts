import { prisma } from './database';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function persist(level: LogLevel, message: string, meta?: unknown) {
  const metaObj = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : undefined;
  const source = (metaObj?.source as string) || 'app';
  const userId = metaObj?.userId as string | undefined;

  prisma.systemLog
    .create({ data: { level, source, message, userId, metadata: metaObj as any } })
    .catch(() => {
      // Logging must never break the calling feature
    });
}

export const logger = {
  // INFO is console-only: persisting every info line would flood SystemLog in production.
  info: (message: string, meta?: unknown) => {
    if (meta) {
      console.warn(`[INFO] ${message}`, meta);
    } else {
      console.warn(`[INFO] ${message}`);
    }
  },
  warn: (message: string, meta?: unknown) => {
    if (meta) {
      console.warn(`[WARN] ${message}`, meta);
    } else {
      console.warn(`[WARN] ${message}`);
    }
    persist('WARN', message, meta);
  },
  error: (message: string, meta?: unknown) => {
    if (meta) {
      console.error(`[ERROR] ${message}`, meta);
    } else {
      console.error(`[ERROR] ${message}`);
    }
    persist('ERROR', message, meta);
  },
};
