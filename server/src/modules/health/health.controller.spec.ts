import { Test, TestingModule } from '@nestjs/testing';
import { TerminusModule, HealthCheckError } from '@nestjs/terminus';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { IndexerHealthIndicator } from './indicators/indexer-health.indicator';
import { PrismaClient } from '../../../generated/prisma/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIndexerIndicator(
  overrides: Partial<{ check: jest.Mock }> = {},
): IndexerHealthIndicator {
  return {
    check: jest.fn().mockResolvedValue({
      soroban_indexer: { status: 'up', lastProcessedLedger: 1000 },
    }),
    ...overrides,
  } as unknown as IndexerHealthIndicator;
}

function makePrisma(mode: 'ok' | Error = 'ok') {
  const $queryRaw =
    mode instanceof Error
      ? jest.fn().mockRejectedValue(mode)
      : jest.fn().mockResolvedValue([{ 1: 1 }]);
  return { $queryRaw };
}

async function buildModule(
  prisma: ReturnType<typeof makePrisma>,
  indexerIndicator: IndexerHealthIndicator,
): Promise<HealthController> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [
      { provide: PrismaClient, useValue: prisma },
      { provide: IndexerHealthIndicator, useValue: indexerIndicator },
    ],
  }).compile();

  return module.get<HealthController>(HealthController);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthController', () => {
  it('should be defined', async () => {
    const controller = await buildModule(makePrisma(), makeIndexerIndicator());
    expect(controller).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // All-healthy path
  // -------------------------------------------------------------------------

  it('returns status "ok" with all three indicators up', async () => {
    const controller = await buildModule(makePrisma(), makeIndexerIndicator());
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.details).toHaveProperty('memory_heap');
    expect(result.details).toHaveProperty('database');
    expect(result.details).toHaveProperty('soroban_indexer');
  });

  // -------------------------------------------------------------------------
  // Database indicator — failure path
  // -------------------------------------------------------------------------

  it('returns status "error" and marks database down when the DB query throws', async () => {
    const dbError = new Error('Connection refused');
    const controller = await buildModule(
      makePrisma(dbError),
      makeIndexerIndicator(),
    );

    // When any indicator fails, Terminus throws ServiceUnavailableException.
    // The detailed result is carried in getResponse().
    let response: Record<string, any>;
    try {
      await controller.check();
      fail('Expected ServiceUnavailableException');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      response = (err as ServiceUnavailableException).getResponse() as Record<
        string,
        any
      >;
    }

    expect(response!.status).toBe('error');
    expect(response!.details.database.status).toBe('down');
    // The error message must surface so operators can diagnose the failure.
    expect(response!.details.database.message).toContain('Connection refused');
  });

  // -------------------------------------------------------------------------
  // Database indicator — pass path
  // -------------------------------------------------------------------------

  it('marks database up when the SELECT 1 query succeeds', async () => {
    const controller = await buildModule(
      makePrisma('ok'),
      makeIndexerIndicator(),
    );
    const result = await controller.check();

    expect(result.details.database.status).toBe('up');
  });

  // -------------------------------------------------------------------------
  // Indexer indicator — failure path
  // -------------------------------------------------------------------------

  it('returns status "error" when the indexer indicator throws HealthCheckError', async () => {
    const stalledIndicator = makeIndexerIndicator({
      check: jest.fn().mockImplementation(() => {
        throw new HealthCheckError('Indexer has stalled', {
          soroban_indexer: {
            status: 'down',
            message:
              'Indexer has stalled — no successful poll within threshold',
            msSinceLastPoll: 20000,
            stalenessThresholdMs: 15000,
            lastProcessedLedger: 999,
          },
        });
      }),
    });

    const controller = await buildModule(makePrisma(), stalledIndicator);

    // Terminus throws ServiceUnavailableException when an indicator fails.
    let response: Record<string, any>;
    try {
      await controller.check();
      fail('Expected ServiceUnavailableException');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      response = (err as ServiceUnavailableException).getResponse() as Record<
        string,
        any
      >;
    }

    expect(response!.status).toBe('error');
    expect(response!.details.soroban_indexer.status).toBe('down');
  });

  // -------------------------------------------------------------------------
  // Indexer indicator — pass path
  // -------------------------------------------------------------------------

  it('marks soroban_indexer up when the indicator resolves successfully', async () => {
    const controller = await buildModule(makePrisma(), makeIndexerIndicator());
    const result = await controller.check();

    expect(result.details.soroban_indexer.status).toBe('up');
  });

  // -------------------------------------------------------------------------
  // Memory indicator still present
  // -------------------------------------------------------------------------

  it('still includes memory_heap in the details', async () => {
    const controller = await buildModule(makePrisma(), makeIndexerIndicator());
    const result = await controller.check();

    expect(result.details).toHaveProperty('memory_heap');
  });
});
