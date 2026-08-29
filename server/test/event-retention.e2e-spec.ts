import { rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { EventRetentionService } from '../src/indexer/retention/event-retention.service';
import { applyMigrations } from './apply-migrations';

describe('EventRetentionService (e2e)', () => {
  let prisma: PrismaClient;
  let service: EventRetentionService;
  const dbPath = path.join(
    os.tmpdir(),
    `agro-retention-e2e-${process.pid}-${Date.now()}.db`,
  );

  beforeAll(async () => {
    rmSync(dbPath, { force: true });
    prisma = new PrismaClient({
      adapter: new PrismaLibSql({ url: `file:${dbPath}` }),
    });
    await applyMigrations(prisma);

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'soroban.eventRetentionDays') return 7;
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new EventRetentionService(prisma, configService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    rmSync(dbPath, { force: true });
  });

  it('prunes Transaction rows older than retention window while preserving recent transactions and domain rows', async () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    const tenDaysAgo = new Date('2026-08-19T12:00:00.000Z');
    const eightDaysAgo = new Date('2026-08-21T12:00:00.000Z');
    const oneDayAgo = new Date('2026-08-28T12:00:00.000Z');

    // 1. Seed domain data
    const userAddress = 'GAUDIT_USER_1';
    const campaignId = 'retention-test-campaign-1';

    await prisma.user.create({
      data: {
        address: userAddress,
        firstSeenAt: 1000n,
      },
    });

    await prisma.campaign.create({
      data: {
        id: campaignId,
        farmer: userAddress,
        title: 'Retention Test Crop',
        createdAt: 1000n,
      },
    });

    const investment = await prisma.investment.create({
      data: {
        id: 'inv-1',
        campaignId,
        investor: userAddress,
        amount: 5000n,
        createdAt: tenDaysAgo,
      },
    });

    const tranche = await prisma.tranche.create({
      data: {
        id: 'tranche-1',
        campaignId,
        recipient: userAddress,
        amount: 1000n,
        releasedAt: 1000n,
        createdAt: tenDaysAgo,
      },
    });

    const dispute = await prisma.dispute.create({
      data: {
        id: 'disp-1',
        campaignId,
        opener: userAddress,
        reason: 'Crop issue',
        status: 'Open',
        openedAt: 1000n,
        createdAt: tenDaysAgo,
      },
    });

    // 2. Seed Transaction audit rows with explicit created dates
    // Using raw insert or standard create + update for custom createdAt
    await prisma.transaction.create({
      data: {
        id: 'tx-old-1',
        type: 'campaign.invested',
        campaignId,
        userId: userAddress,
        createdAt: tenDaysAgo,
      },
    });

    await prisma.transaction.create({
      data: {
        id: 'tx-old-2',
        type: 'campaign.tranche_released',
        campaignId,
        userId: userAddress,
        createdAt: eightDaysAgo,
      },
    });

    await prisma.transaction.create({
      data: {
        id: 'tx-recent',
        type: 'campaign.dispute_opened',
        campaignId,
        userId: userAddress,
        createdAt: oneDayAgo,
      },
    });

    // Verify initial count
    const initialTxs = await prisma.transaction.findMany();
    expect(initialTxs).toHaveLength(3);

    // 3. Execute cleanup with 7-day retention
    const result = await service.cleanupExpiredTransactions(500, now);

    expect(result.deletedCount).toBe(2);
    expect(result.retentionDays).toBe(7);

    // 4. Assert Transaction state
    const remainingTxs = await prisma.transaction.findMany();
    expect(remainingTxs).toHaveLength(1);
    expect(remainingTxs[0].id).toBe('tx-recent');

    // 5. Assert domain entities remain fully intact
    const remainingInvestment = await prisma.investment.findUnique({
      where: { id: investment.id },
    });
    expect(remainingInvestment).not.toBeNull();
    expect(remainingInvestment?.amount).toBe(5000n);

    const remainingTranche = await prisma.tranche.findUnique({
      where: { id: tranche.id },
    });
    expect(remainingTranche).not.toBeNull();
    expect(remainingTranche?.amount).toBe(1000n);

    const remainingDispute = await prisma.dispute.findUnique({
      where: { id: dispute.id },
    });
    expect(remainingDispute).not.toBeNull();
    expect(remainingDispute?.reason).toBe('Crop issue');

    const remainingCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    expect(remainingCampaign).not.toBeNull();

    const remainingUser = await prisma.user.findUnique({
      where: { address: userAddress },
    });
    expect(remainingUser).not.toBeNull();
  });
});
