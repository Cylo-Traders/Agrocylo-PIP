import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaClient } from '../../../generated/prisma/client';
import { IndexerHealthIndicator } from './indicators/indexer-health.indicator';
import { PingDto } from './dto/ping.dto';

/**
 * Exposes the `/health` endpoint used by orchestrators and uptime monitors to
 * determine whether the service is alive and ready to serve traffic.
 *
 * Three indicators run on every request:
 *  1. memory_heap     — process heap does not exceed 512 MB.
 *  2. database        — a lightweight `SELECT 1` against the libSQL/Turso
 *                       database succeeds, confirming the DB connection is live.
 *  3. soroban_indexer — the Soroban event indexer is running and has completed
 *                       a successful poll cycle within the stale-threshold
 *                       window (3 × EVENT_POLL_INTERVAL_MS).
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaClient,
    private readonly indexerIndicator: IndexerHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // 1. Memory
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),

      // 2. Database — execute a minimal raw query; if the connection is broken
      //    or the DB file is missing, this throws and Terminus marks the check
      //    as unhealthy.
      async () => {
        const { HealthCheckError: HCE } = await import('@nestjs/terminus');
        try {
          // $queryRaw returns the raw result; we discard it — we only care that
          // the round-trip to the database succeeds without throwing.
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new HCE('Database check failed', {
            database: { status: 'down', message },
          });
        }
      },

      // 3. Soroban indexer
      () => this.indexerIndicator.check('soroban_indexer'),
    ]);
  }

  /**
   * Trivial endpoint whose sole purpose is to exercise the global
   * ValidationPipe against a real DTO (whitelist/forbidNonWhitelisted/transform).
   */
  @Post('ping')
  ping(@Body() body: PingDto) {
    return { echo: body.message };
  }
}
