import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';

const BATCH_SIZE = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TransactionRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransactionRetentionService.name);
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    void this.pruneExpiredAuditEvents();
    this.interval = setInterval(() => {
      void this.pruneExpiredAuditEvents();
    }, DAY_MS);
    this.interval.unref?.();
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  async pruneExpiredAuditEvents(): Promise<number> {
    const retentionDays = this.config.get<number>('soroban.eventRetentionDays') ?? 7;
    const cutoff = new Date(Date.now() - retentionDays * DAY_MS);
    let deletedTotal = 0;

    while (true) {
      const expired = await this.prisma.transaction.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (expired.length === 0) break;

      const result = await this.prisma.transaction.deleteMany({
        where: { id: { in: expired.map((row) => row.id) } },
      });

      deletedTotal += result.count;
      if (expired.length < BATCH_SIZE) break;
    }

    this.logger.log(
      {
        deletedTotal,
        retentionDays,
        cutoff: cutoff.toISOString(),
        scope: 'transaction_audit_log_only',
      },
      'Completed transaction retention cleanup',
    );

    return deletedTotal;
  }
}
