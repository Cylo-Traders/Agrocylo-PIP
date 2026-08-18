import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicator,
  HealthIndicatorResult,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import { SorobanEventListenerService } from '../../indexer/soroban-event-listener.service';
import { ConfigService } from '@nestjs/config'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { PingDto } from './dto/ping.dto';

/**
 * Custom health indicator for database connectivity.
 * Executes a lightweight `SELECT 1` query via PrismaClient.
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      return this.getStatus(key, false, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Custom health indicator for Soroban RPC connectivity.
 * Performs a lightweight `getLatestLedger` call to verify RPC reachability.
 */
@Injectable()
export class SorobanRpcHealthIndicator extends HealthIndicator {
  constructor(private readonly indexer: SorobanEventListenerService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Access the private rpcServer via type assertion for health check
      const rpcServer = (this.indexer as any).rpcServer;
      if (!rpcServer) {
        return this.getStatus(key, false, {
          message: 'RPC server not initialized',
        });
      }
      await rpcServer.getLatestLedger();
      return this.getStatus(key, true);
    } catch (error) {
      return this.getStatus(key, false, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Custom health indicator for indexer state.
 * Verifies the indexer is running and has processed events recently
 * (within a multiple of the configured poll interval).
 */
@Injectable()
export class IndexerStateHealthIndicator extends HealthIndicator {
  constructor(
    private readonly indexer: SorobanEventListenerService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const indexer = this.indexer as any;
      if (!indexer.isRunning) {
        return this.getStatus(key, false, {
          message: 'Indexer is not running',
        });
      }

      const pollIntervalMs =
        this.config.get<number>('soroban.eventPollIntervalMs') ?? 30000;
      const maxStaleMs = pollIntervalMs * 5; // Allow up to 5 poll intervals of staleness

      const lastProcessed = indexer.lastProcessedLedger;
      if (lastProcessed === 0) {
        // First run, not yet processed anything - consider healthy if running
        return this.getStatus(key, true, {
          message: 'Indexer running, initial sync in progress',
        });
      }

      const latestLedger = await indexer.rpcServer.getLatestLedger();
      const ledgerGap = latestLedger.sequence - lastProcessed;
      // Assuming ~5s per ledger, gap in ledgers * 5000 = ms behind
      const estimatedGapMs = ledgerGap * 5000;

      if (estimatedGapMs > maxStaleMs) {
        return this.getStatus(key, false, {
          message: `Indexer stalled: ~${Math.round(estimatedGapMs / 1000)}s behind chain tip`,
          lastProcessedLedger: lastProcessed,
          chainTip: latestLedger.sequence,
        });
      }

      return this.getStatus(key, true, {
        lastProcessedLedger: lastProcessed,
        chainTip: latestLedger.sequence,
      });
    } catch (error) {
      return this.getStatus(key, false, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Exposes the `/health` endpoint used by orchestrators and uptime monitors to
 * determine whether the service is alive and ready to serve traffic.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly db: DatabaseHealthIndicator,
    private readonly rpc: SorobanRpcHealthIndicator,
    private readonly indexerState: IndexerStateHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
      () => this.db.isHealthy('database'),
      () => this.rpc.isHealthy('soroban_rpc'),
      () => this.indexerState.isHealthy('indexer_state'),
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
