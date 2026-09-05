import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '../../../generated/prisma/client';

/**
 * Scheduled cleanup for the append-only Transaction audit log.
 *
 * Prunes rows older than `EVENT_RETENTION_DAYS` so the table does not
 * grow unbounded. Runs once per day at 03:00 local time (low-traffic
 * window) and on application bootstrap as a safety catch-up after a
 * deployment gap.
 */
@Injectable()
export class TransactionCleanupService {
  private readonly logger = new Logger(TransactionCleanupService.name);
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    this.prisma = new PrismaClient();
  }

  /** Run cleanup immediately on boot in case the service was down across a scheduled window. */
  async onModuleInit(): Promise<void> {
    await this.runCleanup();
  }

  /** Daily cleanup at 03:00. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runCleanup(): Promise<void> {
    const retentionDays = this.config.get<number>('soroban.eventRetentionDays');
    if (!retentionDays || retentionDays <= 0) {
      this.logger.warn(
        'EVENT_RETENTION_DAYS is not configured; skipping transaction cleanup',
      );
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    try {
      const result = await this.prisma.transaction.deleteMany({
        where: {
          createdAt: {
            lt: cutoff,
          },
        },
      });
      this.logger.log(
        `Pruned ${result.count} transaction(s) older than ${retentionDays} day(s) (cutoff: ${cutoff.toISOString()})`,
      );
    } catch (err) {
      this.logger.error('Transaction cleanup failed', err);
    }
  }
}
