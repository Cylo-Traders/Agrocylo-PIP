import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '../../../generated/prisma/client';

export interface CleanupResult {
  deletedCount: number;
  durationMs: number;
  batches: number;
  cutoffDate: Date;
  retentionDays: number;
}

/**
 * EventRetentionService manages the retention lifecycle of raw event audit records.
 *
 * Scope and Data Integrity:
 * Retention pruning is strictly limited to generic `Transaction` audit log rows.
 * Domain records representing actual financial commitments and on-chain state
 * transitions (`Investment`, `Tranche`, `Dispute`, `Order`, `Campaign`, `User`)
 * are permanently preserved to retain full auditability and historical accounting integrity.
 */
@Injectable()
export class EventRetentionService {
  private readonly logger = new Logger(EventRetentionService.name);
  public static readonly DEFAULT_BATCH_SIZE = 500;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Daily scheduled cleanup job running at midnight. Prunes `Transaction` rows
   * older than the configured `EVENT_RETENTION_DAYS`.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'event-retention-cleanup',
  })
  async handleCron(): Promise<CleanupResult> {
    this.logger.log('Starting scheduled event retention cleanup job');
    return this.cleanupExpiredTransactions();
  }

  /**
   * Purges `Transaction` audit log rows older than `EVENT_RETENTION_DAYS`.
   * Deletions are executed in batches to prevent database locks and memory bloat.
   *
   * @param batchSize Number of records to delete per batch (default: 500)
   * @param now Reference timestamp (defaults to current wall-clock time)
   */
  async cleanupExpiredTransactions(
    batchSize = EventRetentionService.DEFAULT_BATCH_SIZE,
    now: Date = new Date(),
  ): Promise<CleanupResult> {
    const startTime = Date.now();
    const retentionDays =
      this.configService.get<number>('soroban.eventRetentionDays') ?? 7;

    if (retentionDays <= 0) {
      this.logger.warn(
        { retentionDays },
        'EVENT_RETENTION_DAYS must be greater than 0; skipping cleanup',
      );
      return {
        deletedCount: 0,
        durationMs: Date.now() - startTime,
        batches: 0,
        cutoffDate: now,
        retentionDays,
      };
    }

    const cutoffDate = new Date(
      now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
    );

    this.logger.log(
      {
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
        batchSize,
      },
      'Running transaction audit log retention cleanup',
    );

    let totalDeleted = 0;
    let batches = 0;

    try {
      while (true) {
        const expiredRows = await this.prisma.transaction.findMany({
          where: {
            createdAt: {
              lt: cutoffDate,
            },
          },
          select: { id: true },
          take: batchSize,
        });

        if (expiredRows.length === 0) {
          break;
        }

        const ids = expiredRows.map((row) => row.id);
        const result = await this.prisma.transaction.deleteMany({
          where: {
            id: {
              in: ids,
            },
          },
        });

        totalDeleted += result.count;
        batches += 1;

        if (result.count === 0 || expiredRows.length < batchSize) {
          break;
        }
      }

      const durationMs = Date.now() - startTime;
      this.logger.log(
        {
          deletedCount: totalDeleted,
          durationMs,
          batches,
          cutoffDate: cutoffDate.toISOString(),
          retentionDays,
        },
        'Event retention cleanup completed successfully',
      );

      return {
        deletedCount: totalDeleted,
        durationMs,
        batches,
        cutoffDate,
        retentionDays,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          deletedCount: totalDeleted,
          durationMs,
          batches,
          cutoffDate: cutoffDate.toISOString(),
        },
        'Failed to complete event retention cleanup',
      );
      throw error;
    }
  }
}
