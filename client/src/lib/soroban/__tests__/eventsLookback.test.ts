import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadRecentEscrowEvents,
  loadOlderEscrowEvents,
  fetchEscrowEvents,
  DEFAULT_LOOKBACK_LEDGERS,
} from '../events';
import { rpc, nativeToScVal } from '@stellar/stellar-sdk';

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: vi.fn(),
    },
  };
});

describe('Soroban Escrow Events Lookback Discovery', () => {
  const mockRpcUrl = 'https://soroban-testnet.stellar.org';
  const mockContractId =
    'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

  const mockOldEvent = {
    id: '0000000000100000-0000000001',
    ledger: 100_000,
    ledgerClosedAt: '2026-08-01T00:00:00Z',
    topic: [nativeToScVal('CampaignCreated'), nativeToScVal(101n)],
    value: nativeToScVal([
      'GFARMER00000000000000000000000000000000000000000000000A1',
      1785000000,
      10000n,
    ]),
  };

  const mockRecentEvent = {
    id: '0000000000180000-0000000001',
    ledger: 180_000,
    ledgerClosedAt: '2026-08-28T00:00:00Z',
    topic: [nativeToScVal('CampaignCreated'), nativeToScVal(202n)],
    value: nativeToScVal([
      'GFARMER00000000000000000000000000000000000000000000000A1',
      1789000000,
      20000n,
    ]),
  };

  let mockGetLatestLedger: ReturnType<typeof vi.fn>;
  let mockGetEvents: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();

    mockGetLatestLedger = vi.fn().mockResolvedValue({
      sequence: 200_000,
    });

    // Simulate RPC returning only events within the requested startLedger
    mockGetEvents = vi
      .fn()
      .mockImplementation(async (params: { startLedger?: number }) => {
        const start = params.startLedger ?? 0;
        const allEvents = [mockOldEvent, mockRecentEvent];
        const matched = allEvents.filter((e) => e.ledger >= start);
        return {
          events: matched,
          cursor: undefined,
          latestLedger: 200_000,
        };
      });

    (rpc.Server as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function (this: any) {
        this.getLatestLedger = (...args: any[]) =>
          (mockGetLatestLedger as (...a: any[]) => any)(...args);
        this.getEvents = (...args: any[]) =>
          (mockGetEvents as (...a: any[]) => any)(...args);
      },
    );
  });

  it('exports default lookback constant matching 120,000 ledgers (~7 days)', () => {
    expect(DEFAULT_LOOKBACK_LEDGERS).toBe(120_000);
  });

  it('omits campaign events older than the lookback window during standard recent scan', async () => {
    // Current ledger = 200,000; lookback = 50,000 -> startLedger = 150,000.
    // mockOldEvent is at ledger 100,000 (outside lookback window).
    // mockRecentEvent is at ledger 180,000 (inside lookback window).
    const events = await loadRecentEscrowEvents({
      rpcUrl: mockRpcUrl,
      contractId: mockContractId,
      lookbackLedgers: 50_000,
    });

    expect(mockGetLatestLedger).toHaveBeenCalledTimes(1);
    expect(mockGetEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        startLedger: 150_000,
      }),
    );

    const campaignIds = events.map((e) => e.campaignId);
    expect(campaignIds).toContain('202');
    expect(campaignIds).not.toContain('101');
    expect(events.length).toBe(1);
  });

  it('surfaces older campaign events when lookback window is expanded', async () => {
    // Current ledger = 200,000; lookback = 120,000 -> startLedger = 80,000.
    // Both mockOldEvent (100,000) and mockRecentEvent (180,000) are included.
    const events = await loadRecentEscrowEvents({
      rpcUrl: mockRpcUrl,
      contractId: mockContractId,
      lookbackLedgers: 120_000,
    });

    expect(mockGetEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        startLedger: 80_000,
      }),
    );

    const campaignIds = events.map((e) => e.campaignId);
    expect(campaignIds).toContain('101');
    expect(campaignIds).toContain('202');
    expect(events.length).toBe(2);
  });

  it('surfaces historical campaigns via loadOlderEscrowEvents pagination', async () => {
    // Paging older from beforeLedger 150,000 with lookback 60,000 -> startLedger = 90,000.
    const events = await loadOlderEscrowEvents({
      rpcUrl: mockRpcUrl,
      contractId: mockContractId,
      beforeLedger: 150_000,
      lookbackLedgers: 60_000,
    });

    expect(mockGetEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        startLedger: 90_000,
      }),
    );

    const oldCampaignEvent = events.find((e) => e.campaignId === '101');
    expect(oldCampaignEvent).toBeDefined();
    expect(oldCampaignEvent?.ledger).toBe(100_000);
  });

  it('handles paginated cursor responses gracefully when maxPages is specified', async () => {
    let callCount = 0;
    mockGetEvents.mockImplementation(async (params: { cursor?: string }) => {
      callCount += 1;
      if (!params.cursor) {
        return {
          events: Array(100).fill(mockRecentEvent),
          cursor: 'cursor-page-2',
        };
      }
      return {
        events: [mockOldEvent],
        cursor: undefined,
      };
    });

    const events = await fetchEscrowEvents({
      rpcUrl: mockRpcUrl,
      contractId: mockContractId,
      startLedger: 50_000,
      maxPages: 5,
    });

    expect(callCount).toBe(2);
    expect(events.length).toBe(101);
    expect(events[0].campaignId).toBe('202');
    expect(events[100].campaignId).toBe('101');
  });
});
