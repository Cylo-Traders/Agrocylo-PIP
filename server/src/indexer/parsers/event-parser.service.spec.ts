import { Logger } from '@nestjs/common';
import { EventParserService } from './event-parser.service';
import type { RawSorobanEvent } from '../types/soroban-events.types';

type MockPrisma = {
  transaction: { findUnique: jest.Mock; create: jest.Mock };
  campaign: { upsert: jest.Mock; update: jest.Mock };
  user: { upsert: jest.Mock };
  investment: { create: jest.Mock };
  tranche: { create: jest.Mock };
  dispute: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock };
};

function makeMockPrisma(): MockPrisma {
  return {
    transaction: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    campaign: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    investment: {
      create: jest.fn().mockResolvedValue({}),
    },
    tranche: {
      create: jest.fn().mockResolvedValue({}),
    },
    dispute: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}

function rawEvent(
  id: string,
  topic: unknown[],
  value: unknown[] | unknown,
): RawSorobanEvent {
  return {
    id,
    type: 'contract',
    contractId: 'CCONTRACT',
    topic,
    value,
    ledger: 1000,
    ledgerClosedAt: '2026-01-01T00:00:00Z',
    txHash: `tx-${id}`,
  };
}

const CAMPAIGN_ID = 123n;
const FARMER = 'GFARMER';
const INVESTOR = 'GINVESTOR';

describe('EventParserService', () => {
  let prisma: MockPrisma;
  let service: EventParserService;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new EventParserService(prisma as any);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CampaignCreated (escrow)', () => {
    it('upserts the campaign with farmer and target amount', async () => {
      await service.processEvent(
        rawEvent(
          'e1',
          ['CampaignCreated', CAMPAIGN_ID],
          [FARMER, 1700000000n, 5000n],
        ),
      );

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { address: FARMER } }),
      );
      expect(prisma.campaign.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '123' },
          create: expect.objectContaining({
            farmer: FARMER,
            targetAmount: 5000n,
          }),
        }),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'e1',
            type: 'campaign.escrow_created',
          }),
        }),
      );
    });

    it('logs and skips a malformed payload without persisting', async () => {
      await service.processEvent(
        rawEvent(
          'e1-bad',
          ['CampaignCreated', CAMPAIGN_ID],
          [FARMER, 1700000000n],
        ),
      );

      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.campaign.upsert).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('ContribReceived', () => {
    it('records an investment and increments totalFunded', async () => {
      await service.processEvent(
        rawEvent(
          'e2',
          ['ContribReceived', CAMPAIGN_ID],
          [INVESTOR, 1700000000n, 250n],
        ),
      );

      expect(prisma.investment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'e2',
            investor: INVESTOR,
            amount: 250n,
          }),
        }),
      );
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { totalFunded: { increment: 250n } },
      });
    });

    it('logs and skips when the amount is not a valid integer', async () => {
      await service.processEvent(
        rawEvent(
          'e2-bad',
          ['ContribReceived', CAMPAIGN_ID],
          [INVESTOR, 1700000000n, 'not-a-number'],
        ),
      );

      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.investment.create).not.toHaveBeenCalled();
    });

    it('is idempotent for a repeated event id', async () => {
      prisma.transaction.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'e2' });

      const evt = rawEvent(
        'e2',
        ['ContribReceived', CAMPAIGN_ID],
        [INVESTOR, 1700000000n, 250n],
      );
      await service.processEvent(evt);
      await service.processEvent(evt);

      expect(prisma.investment.create).toHaveBeenCalledTimes(1);
      expect(prisma.campaign.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('CampaignFunded', () => {
    it('marks the campaign Funded with the authoritative total', async () => {
      await service.processEvent(
        rawEvent('e3', ['CampaignFunded', CAMPAIGN_ID], [1700000000n, 5000n]),
      );

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { status: 'Funded', totalFunded: 5000n },
      });
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent('e3-bad', ['CampaignFunded', CAMPAIGN_ID], [1700000000n]),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('TranchesConfigured', () => {
    it('stores the tranche count on the campaign', async () => {
      await service.processEvent(
        rawEvent('e4', ['TranchesConfigured', CAMPAIGN_ID], [1700000000n, 3]),
      );
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { trancheCount: 3 },
      });
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent(
          'e4-bad',
          ['TranchesConfigured', CAMPAIGN_ID],
          [1700000000n, 'nope'],
        ),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('TrancheReleased', () => {
    it('creates a Tranche row', async () => {
      await service.processEvent(
        rawEvent(
          'e5',
          ['TrancheReleased', CAMPAIGN_ID],
          [FARMER, 1700000000n, 400n],
        ),
      );
      expect(prisma.tranche.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'e5',
            campaignId: '123',
            recipient: FARMER,
            amount: 400n,
          }),
        }),
      );
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent('e5-bad', ['TrancheReleased', CAMPAIGN_ID], [FARMER]),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.tranche.create).not.toHaveBeenCalled();
    });
  });

  describe('HarvestReported', () => {
    it('marks the campaign Harvested with the outcome', async () => {
      await service.processEvent(
        rawEvent(
          'e6',
          ['HarvestReported', CAMPAIGN_ID],
          [FARMER, 'Good', 1700000000n],
        ),
      );
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: {
          status: 'Harvested',
          harvestOutcome: 'Good',
          harvestReportedAt: 1700000000n,
        },
      });
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent('e6-bad', ['HarvestReported', CAMPAIGN_ID], [FARMER]),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('CampaignFailed', () => {
    it('marks the campaign Failed with a refundable amount', async () => {
      await service.processEvent(
        rawEvent('e7', ['CampaignFailed', CAMPAIGN_ID], [1700000000n, 999n]),
      );
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { status: 'Failed', refundable: 999n },
      });
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent('e7-bad', ['CampaignFailed', CAMPAIGN_ID], [1700000000n]),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('ReturnClaimed / RefundClaimed', () => {
    it('upserts the investor without creating a dedicated row', async () => {
      await service.processEvent(
        rawEvent(
          'e8',
          ['ReturnClaimed', CAMPAIGN_ID],
          [INVESTOR, 1700000000n, 100n],
        ),
      );
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { address: INVESTOR } }),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'campaign.return_claimed',
            amount: 100n,
          }),
        }),
      );
    });

    it('logs and skips a malformed RefundClaimed payload', async () => {
      await service.processEvent(
        rawEvent('e9-bad', ['RefundClaimed', CAMPAIGN_ID], [INVESTOR]),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('DisputeOpened', () => {
    it('creates an open Dispute and marks the campaign Disputed', async () => {
      await service.processEvent(
        rawEvent(
          'e10',
          ['DisputeOpened', CAMPAIGN_ID],
          [FARMER, 'late-delivery', 1700000000n, 55],
        ),
      );
      expect(prisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'e10',
            campaignId: '123',
            opener: FARMER,
            reason: 'late-delivery',
            status: 'Open',
            ledgerSequence: 55,
          }),
        }),
      );
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { status: 'Disputed' },
      });
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent('e10-bad', ['DisputeOpened', CAMPAIGN_ID], [FARMER, 'reason']),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.dispute.create).not.toHaveBeenCalled();
    });
  });

  describe('DisputeResolved', () => {
    it('resolves the matching open dispute and marks the campaign Resolved', async () => {
      prisma.dispute.findFirst.mockResolvedValueOnce({ id: 'e10' });

      await service.processEvent(
        rawEvent(
          'e11',
          ['DisputeResolved', CAMPAIGN_ID],
          ['GADMIN', ['PartialSettlement'], 200n, 50n, 1700000000n, 56],
        ),
      );

      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: 'e10' },
        data: expect.objectContaining({
          status: 'Resolved',
          resolution: 'PartialSettlement',
          payoutToFarmer: 200n,
          refundableToInvestors: 50n,
        }),
      });
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { status: 'Resolved' },
      });
    });

    it('still resolves the campaign when no open dispute is on record', async () => {
      await service.processEvent(
        rawEvent(
          'e11b',
          ['DisputeResolved', CAMPAIGN_ID],
          ['GADMIN', ['FullRefund'], 0n, 500n, 1700000000n, 56],
        ),
      );

      expect(prisma.dispute.update).not.toHaveBeenCalled();
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { status: 'Resolved' },
      });
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent('e11-bad', ['DisputeResolved', CAMPAIGN_ID], ['GADMIN']),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('CampaignSettled', () => {
    it('marks the campaign Settled', async () => {
      await service.processEvent(
        rawEvent(
          'e12',
          ['CampaignSettled', CAMPAIGN_ID],
          [FARMER, 1700000000n, 900n, 100n],
        ),
      );
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { status: 'Settled' },
      });
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent(
          'e12-bad',
          ['CampaignSettled', CAMPAIGN_ID],
          [FARMER, 1700000000n],
        ),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('AdminInitialized / AdminUpdated / ContractApproved / ContractRevoked', () => {
    it('persists AdminInitialized as an audit-only transaction', async () => {
      await service.processEvent(
        rawEvent(
          'e13',
          ['AdminInitialized', 'GADMIN'],
          ['GADMIN', 1700000000n, 10],
        ),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'registry.admin_initialized' }),
        }),
      );
      expect(prisma.campaign.update).not.toHaveBeenCalled();
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });

    it('logs and skips a malformed AdminUpdated payload', async () => {
      await service.processEvent(
        rawEvent('e14-bad', ['AdminUpdated', 'GNEW'], ['GOLD']),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('persists ContractApproved as audit-only', async () => {
      await service.processEvent(
        rawEvent(
          'e15',
          ['ContractApproved', 'CCONTRACT2'],
          ['GADMIN', 'CCONTRACT2', 1700000000n, 11],
        ),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'registry.contract_approved' }),
        }),
      );
    });

    it('logs and skips a malformed ContractRevoked payload', async () => {
      await service.processEvent(
        rawEvent('e16-bad', ['ContractRevoked', 'CCONTRACT2'], ['GADMIN']),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('FarmerRegistered', () => {
    it('upserts the farmer with a name from the direct-call payload', async () => {
      await service.processEvent(
        rawEvent(
          'e17',
          ['FarmerRegistered', FARMER],
          [FARMER, 'Jane Doe', 1700000000n, 12],
        ),
      );
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { address: FARMER },
          create: expect.objectContaining({ name: 'Jane Doe' }),
        }),
      );
    });

    it('upserts the farmer without a name from the activity-log mirror payload', async () => {
      await service.processEvent(
        rawEvent(
          'e17b',
          ['FarmerRegistered', FARMER],
          [FARMER, 1700000000n, 12],
        ),
      );
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { address: FARMER }, update: {} }),
      );
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent('e17-bad', ['FarmerRegistered', FARMER], [FARMER]),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });
  });

  describe('CampaignRegistered', () => {
    it('creates the campaign with a title from the direct-call payload', async () => {
      await service.processEvent(
        rawEvent(
          'e18',
          ['CampaignRegistered', CAMPAIGN_ID],
          [FARMER, 'Maize Season', 1700000000n, 13],
        ),
      );
      expect(prisma.campaign.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            farmer: FARMER,
            title: 'Maize Season',
          }),
        }),
      );
    });

    it('creates the campaign without a title from the activity-log mirror payload', async () => {
      await service.processEvent(
        rawEvent(
          'e18b',
          ['CampaignRegistered', CAMPAIGN_ID],
          [FARMER, ['CampaignCreated'], 1700000000n, 13],
        ),
      );
      expect(prisma.campaign.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ farmer: FARMER, title: '' }),
        }),
      );
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent('e18-bad', ['CampaignRegistered', CAMPAIGN_ID], [FARMER]),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.campaign.upsert).not.toHaveBeenCalled();
    });
  });

  describe('CampaignEscrowLinked', () => {
    it('sets the escrow contract on the campaign', async () => {
      await service.processEvent(
        rawEvent(
          'e19',
          ['CampaignEscrowLinked', CAMPAIGN_ID],
          [FARMER, 'CESCROW', 1700000000n, 14],
        ),
      );
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { escrowContract: 'CESCROW', farmer: FARMER },
      });
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent('e19-bad', ['CampaignEscrowLinked', CAMPAIGN_ID], [FARMER]),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('CampaignStatusUpdated', () => {
    it('applies the new status from the direct-call payload', async () => {
      await service.processEvent(
        rawEvent(
          'e20',
          ['CampaignStatusUpdated', CAMPAIGN_ID],
          [['Funding'], ['Funded'], 1700000000n, 15],
        ),
      );
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { status: 'Funded' },
      });
    });

    it('does not mutate status for the activity-log mirror payload', async () => {
      await service.processEvent(
        rawEvent(
          'e20b',
          ['CampaignStatusUpdated', CAMPAIGN_ID],
          [FARMER, ['CampaignStatusChanged'], 1700000000n, 15],
        ),
      );
      expect(prisma.campaign.update).not.toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalled();
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent(
          'e20-bad',
          ['CampaignStatusUpdated', CAMPAIGN_ID],
          [['Funding']],
        ),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('ActivityRecorded', () => {
    it('persists as an audit-only transaction without mutating the campaign', async () => {
      await service.processEvent(
        rawEvent(
          'e21',
          ['ActivityRecorded', CAMPAIGN_ID],
          [FARMER, ['CampaignCreated'], 1700000000n, 16],
        ),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'registry.activity_recorded',
            campaignId: '123',
          }),
        }),
      );
      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it('logs and skips a malformed payload', async () => {
      await service.processEvent(
        rawEvent('e21-bad', ['ActivityRecorded', CAMPAIGN_ID], [FARMER]),
      );
      expect(errorSpy).toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('unrecognized events', () => {
    it('silently ignores events outside our catalog', async () => {
      await service.processEvent(
        rawEvent('unknown1', ['SomeOtherEvent', CAMPAIGN_ID], [1n, 2n]),
      );
      expect(errorSpy).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });
});
