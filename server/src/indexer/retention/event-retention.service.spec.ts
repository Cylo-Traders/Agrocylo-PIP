import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventRetentionService } from './event-retention.service';
import { PrismaClient } from '../../../generated/prisma/client';

type MockPrisma = {
  transaction: {
    findMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  investment: {
    deleteMany: jest.Mock;
  };
  tranche: {
    deleteMany: jest.Mock;
  };
  dispute: {
    deleteMany: jest.Mock;
  };
  campaign: {
    deleteMany: jest.Mock;
  };
  user: {
    deleteMany: jest.Mock;
  };
};

function makeMockPrisma(): MockPrisma {
  return {
    transaction: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    investment: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    tranche: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    dispute: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    campaign: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function makeConfigService(retentionDays = 7): ConfigService {
  return {
    get: jest.fn((key: string) => {
      if (key === 'soroban.eventRetentionDays') return retentionDays;
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('EventRetentionService', () => {
  let prisma: MockPrisma;
  let configService: ConfigService;
  let service: EventRetentionService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = makeMockPrisma();
    configService = makeConfigService(7);
    service = new EventRetentionService(
      prisma as unknown as PrismaClient,
      configService,
    );

    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cleanupExpiredTransactions', () => {
    const fixedNow = new Date('2026-08-29T12:00:00.000Z');
    // With 7 days retention, cutoff should be 2026-08-22T12:00:00.000Z
    const expectedCutoff = new Date('2026-08-22T12:00:00.000Z');

    it('calculates correct cutoff date based on EVENT_RETENTION_DAYS and deletes expired rows', async () => {
      const expiredRows = [{ id: 'tx-old-1' }, { id: 'tx-old-2' }];
      prisma.transaction.findMany.mockResolvedValueOnce(expiredRows);
      prisma.transaction.deleteMany.mockResolvedValueOnce({ count: 2 });

      const result = await service.cleanupExpiredTransactions(500, fixedNow);

      expect(configService.get).toHaveBeenCalledWith(
        'soroban.eventRetentionDays',
      );
      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expectedCutoff,
          },
        },
        select: { id: true },
        take: 500,
      });

      expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['tx-old-1', 'tx-old-2'],
          },
        },
      });

      expect(result.deletedCount).toBe(2);
      expect(result.batches).toBe(1);
      expect(result.cutoffDate).toEqual(expectedCutoff);
      expect(result.retentionDays).toBe(7);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Verify domain tables were never touched
      expect(prisma.investment.deleteMany).not.toHaveBeenCalled();
      expect(prisma.tranche.deleteMany).not.toHaveBeenCalled();
      expect(prisma.dispute.deleteMany).not.toHaveBeenCalled();
      expect(prisma.campaign.deleteMany).not.toHaveBeenCalled();
      expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    });

    it('handles empty results when no transactions are expired', async () => {
      prisma.transaction.findMany.mockResolvedValueOnce([]);

      const result = await service.cleanupExpiredTransactions(500, fixedNow);

      expect(prisma.transaction.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.deleteMany).not.toHaveBeenCalled();
      expect(result.deletedCount).toBe(0);
      expect(result.batches).toBe(0);
    });

    it('processes multiple batches when expired rows exceed batchSize', async () => {
      const batchSize = 2;
      const batch1 = [{ id: 'tx-1' }, { id: 'tx-2' }];
      const batch2 = [{ id: 'tx-3' }, { id: 'tx-4' }];
      const batch3 = [{ id: 'tx-5' }]; // final short batch (< batchSize)

      prisma.transaction.findMany
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce(batch3);

      prisma.transaction.deleteMany
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 1 });

      const result = await service.cleanupExpiredTransactions(
        batchSize,
        fixedNow,
      );

      expect(prisma.transaction.findMany).toHaveBeenCalledTimes(3);
      expect(prisma.transaction.deleteMany).toHaveBeenCalledTimes(3);

      expect(prisma.transaction.deleteMany).toHaveBeenNthCalledWith(1, {
        where: { id: { in: ['tx-1', 'tx-2'] } },
      });
      expect(prisma.transaction.deleteMany).toHaveBeenNthCalledWith(2, {
        where: { id: { in: ['tx-3', 'tx-4'] } },
      });
      expect(prisma.transaction.deleteMany).toHaveBeenNthCalledWith(3, {
        where: { id: { in: ['tx-5'] } },
      });

      expect(result.deletedCount).toBe(5);
      expect(result.batches).toBe(3);
    });

    it('respects a custom retention days setting (e.g. 3 days)', async () => {
      const customConfig = makeConfigService(3);
      const customService = new EventRetentionService(
        prisma as unknown as PrismaClient,
        customConfig,
      );

      // 3 days before fixedNow (2026-08-29) is 2026-08-26
      const expected3DayCutoff = new Date('2026-08-26T12:00:00.000Z');

      prisma.transaction.findMany.mockResolvedValueOnce([{ id: 'tx-old' }]);
      prisma.transaction.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await customService.cleanupExpiredTransactions(
        100,
        fixedNow,
      );

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expected3DayCutoff,
          },
        },
        select: { id: true },
        take: 100,
      });
      expect(result.retentionDays).toBe(3);
      expect(result.cutoffDate).toEqual(expected3DayCutoff);
    });

    it('logs warning and skips deletion if retentionDays <= 0', async () => {
      const invalidConfig = makeConfigService(0);
      const invalidService = new EventRetentionService(
        prisma as unknown as PrismaClient,
        invalidConfig,
      );

      const result = await invalidService.cleanupExpiredTransactions(
        100,
        fixedNow,
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ retentionDays: 0 }),
        expect.stringContaining('EVENT_RETENTION_DAYS must be greater than 0'),
      );
      expect(prisma.transaction.findMany).not.toHaveBeenCalled();
      expect(prisma.transaction.deleteMany).not.toHaveBeenCalled();
      expect(result.deletedCount).toBe(0);
    });

    it('logs execution and completion metrics', async () => {
      prisma.transaction.findMany.mockResolvedValueOnce([{ id: 'tx-1' }]);
      prisma.transaction.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.cleanupExpiredTransactions(500, fixedNow);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          retentionDays: 7,
          cutoffDate: expectedCutoff.toISOString(),
          batchSize: 500,
        }),
        'Running transaction audit log retention cleanup',
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedCount: 1,
          batches: 1,
          cutoffDate: expectedCutoff.toISOString(),
          retentionDays: 7,
        }),
        'Event retention cleanup completed successfully',
      );
    });

    it('logs error and rethrows when a database exception occurs', async () => {
      const dbError = new Error('Database connection failed');
      prisma.transaction.findMany.mockRejectedValueOnce(dbError);

      await expect(
        service.cleanupExpiredTransactions(500, fixedNow),
      ).rejects.toThrow('Database connection failed');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database connection failed',
        }),
        'Failed to complete event retention cleanup',
      );
    });
  });

  describe('handleCron', () => {
    it('executes scheduled cleanup and delegates to cleanupExpiredTransactions', async () => {
      const cleanupSpy = jest
        .spyOn(service, 'cleanupExpiredTransactions')
        .mockResolvedValue({
          deletedCount: 10,
          durationMs: 42,
          batches: 1,
          cutoffDate: new Date(),
          retentionDays: 7,
        });

      const result = await service.handleCron();

      expect(logSpy).toHaveBeenCalledWith(
        'Starting scheduled event retention cleanup job',
      );
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
      expect(result.deletedCount).toBe(10);
    });
  });
});
