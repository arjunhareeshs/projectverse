import os from 'node:os';
import { createClient } from 'redis';
import { env } from '../config/env';
import { logger } from './logger';

function buildClient(url: string) {
  return createClient({ url });
}

export type RedisClient = ReturnType<typeof buildClient>;

let client: RedisClient | null = null;

/** Connects the shared Redis client once at startup. Without REDIS_URL the app runs single-instance (in-memory). */
export async function connectRedis(): Promise<RedisClient | null> {
  if (client || !env.REDIS_URL) return client;

  const c = buildClient(env.REDIS_URL);
  let lastErrorLog = 0;
  c.on('error', (err) => {
    // The client retries forever while Redis is down; log at most every 30s.
    if (Date.now() - lastErrorLog > 30_000) {
      lastErrorLog = Date.now();
      logger.error(`Redis error: ${err.message}`, { source: 'redis' });
    }
  });
  try {
    await Promise.race([
      c.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout after 5s')), 5_000)),
    ]);
    client = c;
    logger.info('Redis connected.');
  } catch (err: any) {
    c.destroy();
    logger.error(`Redis unavailable, falling back to in-memory state: ${err.message}`, { source: 'redis' });
  }
  return client;
}

export function getRedis(): RedisClient | null {
  return client?.isReady ? client : null;
}

const instanceId = `${os.hostname()}:${process.pid}`;

/**
 * Runs `fn` only if this process wins a Redis lock, so a scheduled job fires once
 * even when several worker containers are running. Without Redis it just runs.
 */
export async function withLock(name: string, ttlMs: number, fn: () => Promise<void>): Promise<void> {
  const redis = getRedis();
  if (!redis) return fn();

  const key = `lock:${name}`;
  const acquired = await redis.set(key, instanceId, { NX: true, PX: ttlMs });
  if (!acquired) {
    logger.info(`Skipping "${name}" — another instance holds the lock.`);
    return;
  }
  try {
    await fn();
  } finally {
    if ((await redis.get(key)) === instanceId) await redis.del(key);
  }
}
