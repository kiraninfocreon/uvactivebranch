import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // Defense-in-depth only — the real fix is making sure nothing
      // slow (argon2 hashing, network calls, etc.) ever runs inside an
      // interactive `$transaction(async (tx) => ...)` callback; see
      // AuthService.staffTotpSetup / adminTotpSetup for the incident
      // this came from. This just gives every interactive transaction
      // a bit more headroom than Prisma's 5s default before it's
      // killed, so a brief slowdown on a small/free hosting plan
      // doesn't immediately surface as "Transaction already closed."
      transactionOptions: { maxWait: 5000, timeout: 10000 },
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to Postgres');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
