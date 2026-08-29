import { HealthCheckError } from '@nestjs/terminus';
import { IndexerHealthIndicator } from './indexer-health.indicator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5000;
const STALE_MULTIPLIER = 3;
const STALE_THRESHOLD_MS = STALE_MULTIPLIER * POLL_INTERVAL_MS; // 15 000 ms

function makeConfig(pollIntervalMs = POLL_INTERVAL_MS) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'soroban.eventPollIntervalMs') return pollIntervalMs;
      return undefined;
    }),
  } as any;
}

function makeIndexer(
  status: {
    isEnabled?: boolean;
    isRunning?: boolean;
    lastProcessedLedger?: number;
    lastSuccessfulPollAt?: number | null;
  } = {},
) {
  const defaults = {
    isEnabled: true,
    isRunning: true,
    lastProcessedLedger: 1000,
    lastSuccessfulPollAt: Date.now(),
  };
  return {
    getHealthStatus: jest.fn().mockReturnValue({ ...defaults, ...status }),
  } as any;
}

function buildIndicator(indexer: any, config?: any): IndexerHealthIndicator {
  return new IndexerHealthIndicator(indexer, config ?? makeConfig());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndexerHealthIndicator', () => {
  // -------------------------------------------------------------------------
  // Healthy — running and recently polled
  // -------------------------------------------------------------------------

  it('returns status up when indexer is running and polled recently', async () => {
    const indicator = buildIndicator(
      makeIndexer({ lastSuccessfulPollAt: Date.now() - 1000 }),
    );

    const result = await indicator.check('soroban_indexer');

    expect(result.soroban_indexer.status).toBe('up');
  });

  // -------------------------------------------------------------------------
  // Healthy — never polled yet (grace window)
  // -------------------------------------------------------------------------

  it('returns status up when indexer is running but has not polled yet', async () => {
    const indicator = buildIndicator(
      makeIndexer({ lastSuccessfulPollAt: null }),
    );

    const result = await indicator.check('soroban_indexer');

    expect(result.soroban_indexer.status).toBe('up');
  });

  // -------------------------------------------------------------------------
  // Healthy — indexing deliberately switched off (no contract IDs configured)
  // -------------------------------------------------------------------------

  it('returns status up when the indexer is disabled by configuration', async () => {
    const indicator = buildIndicator(
      makeIndexer({ isEnabled: false, isRunning: false }),
    );

    const result = await indicator.check('soroban_indexer');

    expect(result.soroban_indexer.status).toBe('up');
    expect(result.soroban_indexer.enabled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Failure — indexer not running
  // -------------------------------------------------------------------------

  it('throws HealthCheckError when indexer is not running', async () => {
    const indicator = buildIndicator(makeIndexer({ isRunning: false }));

    await expect(indicator.check('soroban_indexer')).rejects.toThrow(
      HealthCheckError,
    );
  });

  it('includes the key in the error result when indexer is not running', async () => {
    const indicator = buildIndicator(makeIndexer({ isRunning: false }));

    try {
      await indicator.check('soroban_indexer');
      fail('Expected HealthCheckError');
    } catch (err) {
      expect(err).toBeInstanceOf(HealthCheckError);
      const hce = err as HealthCheckError;
      expect(hce.causes).toHaveProperty('soroban_indexer');
      expect((hce.causes as any).soroban_indexer.status).toBe('down');
    }
  });

  // -------------------------------------------------------------------------
  // Failure — stalled (last poll too long ago)
  // -------------------------------------------------------------------------

  it('throws HealthCheckError when last successful poll exceeds the stale threshold', async () => {
    // Simulate a poll that happened 4× the poll interval ago (well past 3×).
    const stalePollAt = Date.now() - 4 * POLL_INTERVAL_MS;
    const indicator = buildIndicator(
      makeIndexer({ lastSuccessfulPollAt: stalePollAt }),
    );

    await expect(indicator.check('soroban_indexer')).rejects.toThrow(
      HealthCheckError,
    );
  });

  it('includes stale diagnostic details in the HealthCheckError', async () => {
    const stalePollAt = Date.now() - 4 * POLL_INTERVAL_MS;
    const indicator = buildIndicator(
      makeIndexer({ lastSuccessfulPollAt: stalePollAt }),
    );

    try {
      await indicator.check('soroban_indexer');
      fail('Expected HealthCheckError');
    } catch (err) {
      expect(err).toBeInstanceOf(HealthCheckError);
      const hce = err as HealthCheckError;
      const detail = (hce.causes as any).soroban_indexer;
      expect(detail.status).toBe('down');
      expect(detail.msSinceLastPoll).toBeGreaterThanOrEqual(STALE_THRESHOLD_MS);
      expect(detail.stalenessThresholdMs).toBe(STALE_THRESHOLD_MS);
    }
  });

  // -------------------------------------------------------------------------
  // Boundary — poll just within the threshold should still be healthy
  // -------------------------------------------------------------------------

  it('returns status up when last poll is just within the stale threshold boundary', async () => {
    // 1 ms before crossing the threshold.
    const borderlinePollAt = Date.now() - (STALE_THRESHOLD_MS - 1);
    const indicator = buildIndicator(
      makeIndexer({ lastSuccessfulPollAt: borderlinePollAt }),
    );

    const result = await indicator.check('soroban_indexer');

    expect(result.soroban_indexer.status).toBe('up');
  });

  // -------------------------------------------------------------------------
  // Configurable poll interval
  // -------------------------------------------------------------------------

  it('uses the configured poll interval to derive the stale threshold', async () => {
    const customPollMs = 10_000;

    // 25 s ago — healthy under 30 s threshold (3×10 000) but stale under 15 s (3×5 000).
    const pollAt = Date.now() - 25_000;
    const indicator = buildIndicator(
      makeIndexer({ lastSuccessfulPollAt: pollAt }),
      makeConfig(customPollMs),
    );

    const result = await indicator.check('soroban_indexer');

    expect(result.soroban_indexer.status).toBe('up');

    // Sanity: same timestamp is stale with the default 5 s interval.
    const tightIndicator = buildIndicator(
      makeIndexer({ lastSuccessfulPollAt: pollAt }),
      makeConfig(POLL_INTERVAL_MS),
    );
    await expect(tightIndicator.check('soroban_indexer')).rejects.toThrow(
      HealthCheckError,
    );
  });
});
