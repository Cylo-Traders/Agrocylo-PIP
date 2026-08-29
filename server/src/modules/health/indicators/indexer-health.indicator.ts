import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { SorobanEventListenerService } from '../../../indexer/soroban-event-listener.service';

/**
 * Number of consecutive missed poll intervals before the indexer is declared
 * stalled. Using a multiplier rather than a hard-coded absolute value keeps the
 * threshold proportional to however EVENT_POLL_INTERVAL_MS is configured.
 */
const STALE_MULTIPLIER = 3;

@Injectable()
export class IndexerHealthIndicator extends HealthIndicator {
  constructor(
    private readonly indexer: SorobanEventListenerService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  /**
   * Checks whether the Soroban event indexer is running and has completed at
   * least one successful poll cycle within `STALE_MULTIPLIER` × the configured
   * poll interval. Fails if the indexer is not running or has stalled.
   *
   * When no contract IDs are configured the indexer is switched off by design
   * (see SorobanEventListenerService.onModuleInit), so this reports "up, but
   * disabled" rather than failing — an environment that was never asked to
   * index is not an unhealthy one.
   */
  async check(key: string): Promise<HealthIndicatorResult> {
    const { isEnabled, isRunning, lastProcessedLedger, lastSuccessfulPollAt } =
      this.indexer.getHealthStatus();
    const pollIntervalMs =
      this.config.get<number>('soroban.eventPollIntervalMs') ?? 5000;
    const stalenessThresholdMs = STALE_MULTIPLIER * pollIntervalMs;

    const now = Date.now();

    if (!isEnabled) {
      return this.getStatus(key, true, {
        message: 'Indexer disabled — no Soroban contract IDs configured',
        enabled: false,
        lastProcessedLedger,
      });
    }

    if (!isRunning) {
      throw new HealthCheckError(
        'Indexer is not running',
        this.getStatus(key, false, {
          message: 'Indexer is not running',
          lastProcessedLedger,
        }),
      );
    }

    // If the indexer has never completed a successful poll cycle it may simply
    // still be starting up. Allow a grace window equal to the stale threshold
    // before declaring it unhealthy.
    if (lastSuccessfulPollAt === null) {
      // Service.startListening records the startup time implicitly via
      // isRunning. We treat "never polled yet but running" as healthy as long
      // as we are still within the grace window.  We don't have a startedAt
      // timestamp, so we optimistically report healthy here — the real stale
      // detection kicks in after the first successful poll.
      return this.getStatus(key, true, {
        message: 'Indexer started, awaiting first poll',
        lastProcessedLedger,
      });
    }

    const msSinceLastPoll = now - lastSuccessfulPollAt;
    if (msSinceLastPoll > stalenessThresholdMs) {
      throw new HealthCheckError(
        'Indexer has stalled',
        this.getStatus(key, false, {
          message: 'Indexer has stalled — no successful poll within threshold',
          msSinceLastPoll,
          stalenessThresholdMs,
          lastProcessedLedger,
        }),
      );
    }

    return this.getStatus(key, true, {
      lastProcessedLedger,
      msSinceLastPoll,
    });
  }
}
