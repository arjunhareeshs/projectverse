import type { Request } from 'express';
import rateLimit, { ipKeyGenerator, MemoryStore, type Options, type Store, type IncrementResponse } from 'express-rate-limit';
import { verifyAccessToken } from '../config/jwt';
import { getRedis } from './redis';

/**
 * Counts hits in Redis so every server replica shares one budget per client.
 * Falls back to per-process memory when Redis is not configured or a call fails,
 * so a Redis outage degrades limits instead of rejecting traffic.
 */
class SharedStore implements Store {
  prefix: string;
  private windowMs = 60_000;
  private memory = new MemoryStore();

  constructor(prefix: string) {
    this.prefix = `rl:${prefix}:`;
  }

  init(options: Options) {
    this.windowMs = options.windowMs;
    this.memory.init(options);
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redis = getRedis();
    if (redis) {
      try {
        const k = this.prefix + key;
        const [hits, ttl] = (await redis.multi().incr(k).pTTL(k).exec()) as unknown as [number, number];
        let ttlMs = ttl;
        if (ttlMs < 0) {
          await redis.pExpire(k, this.windowMs);
          ttlMs = this.windowMs;
        }
        return { totalHits: hits, resetTime: new Date(Date.now() + ttlMs) };
      } catch {
        // fall through to memory
      }
    }
    return this.memory.increment(key);
  }

  async decrement(key: string) {
    const redis = getRedis();
    if (redis) {
      try {
        await redis.decr(this.prefix + key);
        return;
      } catch {
        // fall through
      }
    }
    await this.memory.decrement(key);
  }

  async resetKey(key: string) {
    await getRedis()?.del(this.prefix + key).catch(() => undefined);
    await this.memory.resetKey(key);
  }
}

/**
 * Keys by authenticated user when a valid bearer token is present, else by IP.
 * Students on a shared campus network often reach the server from one public IP;
 * keying only by IP would make them share (and exhaust) a single budget.
 */
export function userOrIpKey(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      return `u:${verifyAccessToken(auth.slice(7).trim()).sub}`;
    } catch {
      // invalid/expired token → treat as anonymous
    }
  }
  return `ip:${ipKeyGenerator(req.ip || '')}`;
}

export function createRateLimiter(
  name: string,
  options: {
    windowMs: number;
    limit: number;
    message?: string;
    keyGenerator?: (req: Request) => string;
  },
) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new SharedStore(name),
    keyGenerator: options.keyGenerator ?? userOrIpKey,
    ...(options.message ? { message: { message: options.message } } : {}),
  });
}
