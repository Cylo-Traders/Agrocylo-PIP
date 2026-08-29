import { rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { EventParserService } from '../src/indexer/parsers/event-parser.service';
import type { RawSorobanEvent } from '../src/indexer/types/soroban-events.types';
import { applyMigrations } from './apply-migrations';

const CAMPAIGN_ID = 'lifecycle-campaign-1';
const FARMER = 'GFARMER_LIFECYCLE';

function rawEvent(
  id: string,
  topic: unknown[],
  value: unknown[],
): RawSorobanEvent {
  return {
    id,
    type: 'contract',
    contractId: 'CINDEXER_LIFECYCLE',
    topic,
    value,
    ledger: 1000,
    ledgerClosedAt: '2026-01-01T00:00:00Z',
    txHash: `tx-${id}`,
  };
}

describe('Indexer campaign lifecycle (e2e)', () => {
  let prisma: PrismaClient;
  let parser: EventParserService;
  const dbPath = path.join(
    os.tmpdir(),
    `agro-indexer-e2e-${process.pid}-${Date.now()}.db`,
  );

  beforeAll(async () => {
    // Fresh SQLite file per run, so the lifecycle assertions below never see
    // state left behind by a previous run or another test file.
    rmSync(dbPath, { force: true });
    prisma = new PrismaClient({
      adapter: new PrismaLibSql({ url: `file:${dbPath}` }),
    });
    await applyMigrations(prisma);
    parser = new EventParserService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    rmSync(dbPath, { force: true });
  });

  const status = async (): Promise<string> => {
    const campaign = await prisma.campaign.findUnique({
      where: { id: CAMPAIGN_ID },
    });
    return campaign?.status ?? '';
  };

  it('advances an indexed campaign Funded → InProduction → Harvested', async () => {
    // Escrow-side creation seeds the Campaign row (default status: Active).
    await parser.processEvent(
      rawEvent(
        'evt-created',
        ['CampaignCreated', CAMPAIGN_ID],
        [FARMER, 1700000000n, 5000n],
      ),
    );
    expect(await status()).toBe('Active');

    // Reaching the funding target flips the indexed status to Funded.
    await parser.processEvent(
      rawEvent(
        'evt-funded',
        ['CampaignFunded', CAMPAIGN_ID],
        [1700000001n, 5000n],
      ),
    );
    expect(await status()).toBe('Funded');

    // The first tranche release mirrors the contract's Funded → InProduction
    // transition (issue #173).
    await parser.processEvent(
      rawEvent(
        'evt-tranche-1',
        ['TrancheReleased', CAMPAIGN_ID],
        [FARMER, 1700000002n, 1000n],
      ),
    );
    expect(await status()).toBe('InProduction');

    // A subsequent release on an already-InProduction campaign is a no-op and
    // must not reset or duplicate-write the status.
    await parser.processEvent(
      rawEvent(
        'evt-tranche-2',
        ['TrancheReleased', CAMPAIGN_ID],
        [FARMER, 1700000003n, 1000n],
      ),
    );
    expect(await status()).toBe('InProduction');

    // Reporting the harvest completes the lifecycle.
    await parser.processEvent(
      rawEvent(
        'evt-harvest',
        ['HarvestReported', CAMPAIGN_ID],
        [FARMER, 'Good', 1700000004n],
      ),
    );
    expect(await status()).toBe('Harvested');

    // The harvest outcome is persisted alongside the status transition.
    const campaign = await prisma.campaign.findUnique({
      where: { id: CAMPAIGN_ID },
    });
    expect(campaign?.harvestOutcome).toBe('Good');
  });
});
