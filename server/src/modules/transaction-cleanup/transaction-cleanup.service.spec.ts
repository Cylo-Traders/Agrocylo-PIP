import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TransactionCleanupService } from './transaction-cleanup.service';

describe('TransactionCleanupService', () => {
  let service: TransactionCleanupService;

  const mockDeleteMany = jest.fn();
  const mockPrismaClient = jest.fn().mockImplementation(() => ({
    transaction: {
      deleteMany: mockDeleteMany,
    },
  }));

  beforeEach(async () => {
    mockDeleteMany.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionCleanupService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'soroban.eventRetentionDays') return 7;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionCleanupService>(TransactionCleanupService);
    // Inject mocked Prisma client
    (service as any).prisma = new mockPrismaClient();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runCleanup', () => {
    it('prunes transactions older than retention days', async () => {
      mockDeleteMany.mockResolvedValue({ count: 42 });

      await service.runCleanup();

      expect(mockDeleteMany).toHaveBeenCalledTimes(1);
      const where = mockDeleteMany.mock.calls[0][0].where;
      expect(where.createdAt.lt).toBeInstanceOf(Date);

      const cutoff = where.createdAt.lt as Date;
      const now = new Date();
      const diffDays = (now.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(7, 0);
    });

    it('skips cleanup when retention days is not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TransactionCleanupService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => undefined),
            },
          },
        ],
      }).compile();

      const noConfigService = module.get<TransactionCleanupService>(TransactionCleanupService);
      (noConfigService as any).prisma = new mockPrismaClient();

      await noConfigService.runCleanup();
      expect(mockDeleteMany).not.toHaveBeenCalled();
    });

    it('skips cleanup when retention days is zero or negative', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TransactionCleanupService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => 0),
            },
          },
        ],
      }).compile();

      const zeroConfigService = module.get<TransactionCleanupService>(TransactionCleanupService);
      (zeroConfigService as any).prisma = new mockPrismaClient();

      await zeroConfigService.runCleanup();
      expect(mockDeleteMany).not.toHaveBeenCalled();
    });

    it('logs error when deleteMany throws', async () => {
      const loggerError = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
      mockDeleteMany.mockRejectedValue(new Error('DB failure'));

      await service.runCleanup();

      expect(loggerError).toHaveBeenCalledWith('Transaction cleanup failed', expect.any(Error));
      loggerError.mockRestore();
    });
  });

  describe('onModuleInit', () => {
    it('runs cleanup on module init', async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 });
      const runCleanupSpy = jest.spyOn(service, 'runCleanup');

      await service.onModuleInit();

      expect(runCleanupSpy).toHaveBeenCalledTimes(1);
      runCleanupSpy.mockRestore();
    });
  });
});
