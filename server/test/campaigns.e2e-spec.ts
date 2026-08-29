import { rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/setup-app';
import { PrismaClient } from './../generated/prisma/client';
import { applyMigrations } from './apply-migrations';

describe('Campaigns & Investors API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const farmer = 'GFARMERADDRESS0000000000000000000000000000000000000000000';
  const investor = 'GINVESTORADDRESS00000000000000000000000000000000000000000';
  const campaignId = 'e2e-campaign-1';
  const settledCampaignId = 'e2e-campaign-2';

  const dbPath = path.join(
    os.tmpdir(),
    `agro-campaigns-e2e-${process.pid}-${Date.now()}.db`,
  );
  const previousDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    // Point both this bootstrap and the app's own PrismaClient at an isolated,
    // freshly migrated database so the assertions never see leftover state.
    rmSync(dbPath, { force: true });
    process.env.DATABASE_URL = `file:${dbPath}`;

    const migrator = new PrismaClient({
      adapter: new PrismaLibSql({ url: `file:${dbPath}` }),
    });
    await applyMigrations(migrator);
    await migrator.$disconnect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleFixture.get(PrismaClient);

    await prisma.user.upsert({
      where: { address: investor },
      update: {},
      create: { address: investor },
    });

    await prisma.campaign.upsert({
      where: { id: campaignId },
      update: {},
      create: {
        id: campaignId,
        farmer,
        title: 'E2E Maize Campaign',
        description: 'Seeded for e2e coverage',
        targetAmount: 1000n,
        status: 'Resolved',
        totalFunded: 1000n,
        refundable: 600n,
        createdAt: 1700000000n,
      },
    });

    await prisma.investment.upsert({
      where: { id: 'e2e-investment-1' },
      update: {},
      create: {
        id: 'e2e-investment-1',
        campaignId,
        investor,
        amount: 400n,
        timestamp: 1700000001n,
      },
    });

    await prisma.tranche.upsert({
      where: { id: 'e2e-tranche-1' },
      update: {},
      create: {
        id: 'e2e-tranche-1',
        campaignId,
        recipient: farmer,
        amount: 200n,
        releasedAt: 1700000002n,
      },
    });

    await prisma.dispute.upsert({
      where: { id: 'e2e-dispute-1' },
      update: {},
      create: {
        id: 'e2e-dispute-1',
        campaignId,
        opener: investor,
        reason: 'delay',
        status: 'Resolved',
        openedAt: 1700000003n,
      },
    });

    // Second campaign, same investor, in the post-settlement (returnable) path.
    await prisma.campaign.upsert({
      where: { id: settledCampaignId },
      update: {},
      create: {
        id: settledCampaignId,
        farmer,
        title: 'E2E Settled Campaign',
        description: 'Seeded for e2e coverage',
        targetAmount: 500n,
        status: 'Settled',
        totalFunded: 500n,
        returnable: 250n,
        createdAt: 1700000010n,
      },
    });

    await prisma.investment.upsert({
      where: { id: 'e2e-investment-2' },
      update: {},
      create: {
        id: 'e2e-investment-2',
        campaignId: settledCampaignId,
        investor,
        amount: 250n,
        timestamp: 1700000011n,
      },
    });
  });

  afterAll(async () => {
    await app.close();
    rmSync(dbPath, { force: true });
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it('GET /campaigns is paginated and filters by status', async () => {
    const res = await request(app.getHttpServer())
      .get('/campaigns')
      .query({ status: 'Resolved', page: 1, limit: 10 })
      .expect(200);

    expect(res.body.meta).toEqual(
      expect.objectContaining({ page: 1, limit: 10 }),
    );
    expect(res.body.data.some((c: { id: string }) => c.id === campaignId)).toBe(
      true,
    );
    expect(
      res.body.data.every((c: { status: string }) => c.status === 'Resolved'),
    ).toBe(true);
  });

  it('GET /campaigns rejects an unknown status filter', () => {
    return request(app.getHttpServer())
      .get('/campaigns')
      .query({ status: 'NotAStatus' })
      .expect(400);
  });

  it('GET /campaigns/:id returns tranches, dispute history, and funding summary', async () => {
    const res = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .expect(200);

    expect(res.body.tranches).toHaveLength(1);
    expect(res.body.tranches[0].amount).toBe('200');
    expect(res.body.disputes).toHaveLength(1);
    expect(res.body.disputes[0].status).toBe('Resolved');
    expect(res.body.fundingSummary).toEqual(
      expect.objectContaining({
        totalFunded: '1000',
        refundable: '600',
        returnable: '0',
        investmentCount: 1,
        investedTotal: '400',
      }),
    );
  });

  it('GET /campaigns/:id 404s for an unknown campaign', () => {
    return request(app.getHttpServer())
      .get('/campaigns/does-not-exist')
      .expect(404);
  });

  it("GET /investors/:address/portfolio returns the investor's positions and claimable amounts for both the refundable (Resolved) and returnable (Settled) paths", async () => {
    const res = await request(app.getHttpServer())
      .get(`/investors/${investor}/portfolio`)
      .expect(200);

    expect(res.body.positions).toHaveLength(2);
    expect(res.body.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campaignId,
          amount: '400',
          // contributed(400) * refundable(600) / totalFunded(1000) = 240
          claimable: '240',
        }),
        expect.objectContaining({
          campaignId: settledCampaignId,
          amount: '250',
          // contributed(250) * returnable(250) / totalFunded(500) = 125
          claimable: '125',
        }),
      ]),
    );
    expect(res.body.summary.totalInvested).toBe('650');
    expect(res.body.summary.totalClaimable).toBe('365');
  });
});
