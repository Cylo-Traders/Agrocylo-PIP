import { PrismaClient } from '../generated/prisma/client';
import { EventParserService } from '../src/indexer/parsers/event-parser.service';
import type { RawSorobanEvent } from '../src/indexer/types/soroban-events.types';
import { createTestPrismaClient, resetDatabase } from './e2e-database';

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

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    // e2e specs share one Postgres schema, so clear it before seeding rather
    // than assuming another file left the tables empty.
    await resetDatabase(prisma);
    parser = new EventParserService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
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
