import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  // Deliberately NOT wrapped in the standard success envelope (see
  // ResponseEnvelopeInterceptor) and returns 503 on failure, not 200 —
  // this is what the load balancer's health check and uptime monitor
  // are wired to (spec §14).
  @Get()
  async check(@Res() res: Response) {
    const db = await this.checkDb();
    const redis = await this.checkRedis();
    const ok = db === 'ok' && redis === 'ok';
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'fail', db, redis, time: new Date().toISOString() });
  }

  private async checkDb(): Promise<'ok' | 'fail'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'fail';
    }
  }

  private async checkRedis(): Promise<'ok' | 'fail'> {
    const url = this.config.get<string>('redisUrl');
    if (!url) return 'ok'; // Redis is optional at MVP scale (see RateLimitService) — absence isn't a failure
    const client = new Redis(url, { lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 1 });
    try {
      await client.connect();
      await client.ping();
      return 'ok';
    } catch {
      return 'fail';
    } finally {
      client.disconnect();
    }
  }
}
