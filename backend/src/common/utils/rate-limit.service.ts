import { Injectable, OnModuleDestroy, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_ATTEMPTS = 5;

/**
 * Same policy as the original cloud-api's rateLimit.js (5 attempts / 15
 * min, keyed on both the identifier AND the source IP so an attacker
 * can't dodge one by rotating the other) — but now backed by Redis when
 * available, so the limit actually holds across multiple horizontally-
 * scaled API instances. Falls back to an in-memory Map (correct for a
 * single instance, resets on restart) when REDIS_URL isn't set, which is
 * an honest tradeoff for an early-launch single-instance deployment —
 * not a silent gap.
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private redis: Redis | null = null;
  private memory = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('redisUrl');
    if (url) {
      this.redis = new Redis(url, { maxRetriesPerRequest: 2 });
      this.redis.on('error', (e) => this.logger.warn(`Redis error, rate limiting may degrade: ${e.message}`));
    } else {
      this.logger.warn('REDIS_URL not set — login rate limiting is in-memory/per-process only.');
      setInterval(() => this.sweepMemory(), WINDOW_SECONDS * 1000).unref();
    }
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit();
  }

  /** Throws 429 if either key is over budget. Call BEFORE attempting the login check. */
  async assertNotBlocked(keys: string[]): Promise<void> {
    for (const key of keys) {
      const count = await this.getCount(key);
      if (count >= MAX_ATTEMPTS) {
        throw new HttpException('Too many failed attempts. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  async recordFailure(key: string): Promise<void> {
    if (this.redis) {
      const n = await this.redis.incr(key);
      if (n === 1) await this.redis.expire(key, WINDOW_SECONDS);
      return;
    }
    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.resetAt < now) {
      this.memory.set(key, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 });
    } else {
      entry.count += 1;
    }
  }

  async clear(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(key);
      return;
    }
    this.memory.delete(key);
  }

  private async getCount(key: string): Promise<number> {
    if (this.redis) {
      const val = await this.redis.get(key);
      return val ? parseInt(val, 10) : 0;
    }
    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.resetAt < now) return 0;
    return entry.count;
  }

  private sweepMemory() {
    const now = Date.now();
    for (const [key, entry] of this.memory.entries()) {
      if (entry.resetAt < now) this.memory.delete(key);
    }
  }
}
