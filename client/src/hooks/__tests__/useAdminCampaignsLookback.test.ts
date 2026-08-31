import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAdminCampaigns } from '../useAdminCampaigns';
import * as eventsModule from '../../lib/soroban/events';
import * as contractClientModule from '../../lib/soroban/contractClient';
import * as apiModule from '../../lib/api/client';

vi.mock('../../lib/soroban/config', () => ({
  ESCROW_CONTRACT_ID: 'CESCROW000000000000000000000000000000000000000000000101',
  RPC_URL: 'https://soroban-testnet.stellar.org',
  isEscrowConfigured: () => true,
}));

vi.mock('../../lib/api/config', () => ({
  isBackendApiEnabled: () => false,
}));

describe('useAdminCampaigns Lookback & Discovery Strategy', () => {
  let queryClient: QueryClient;

  const mockEscrowCampaign = {
    farmer: 'GFARMER00000000000000000000000000000000000000000000000A1',
    target_amount: 10000n,
    token_address: 'CTOKEN0000000000000000000000000000000000000000000000000D4',
    deadline: 1793000000n,
    harvest_metadata: 'Organic Maize PIP',
    total_funded: 2500n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Funding' as const },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.spyOn(contractClientModule, 'getEscrowClient').mockResolvedValue(
      {} as never,
    );
    vi.spyOn(contractClientModule, 'contractMethod').mockReturnValue((() =>
      Promise.resolve({ result: mockEscrowCampaign })) as never);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('scans events using the configured lookback window', async () => {
    const mockLoadEvents = vi
      .spyOn(eventsModule, 'loadRecentEscrowEvents')
      .mockResolvedValue([
        {
          id: '1',
          ledger: 180000,
          ledgerClosedAt: '2026-08-28T00:00:00Z',
          name: 'CampaignCreated',
          campaignId: '202',
          values: [],
        },
      ]);

    const { result } = renderHook(
      () => useAdminCampaigns({ lookbackLedgers: 50_000 }),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockLoadEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        lookbackLedgers: 50_000,
      }),
    );
    expect(result.current.data?.length).toBe(1);
    expect(result.current.data?.[0].id).toBe('202');
  });

  it('incorporates older campaigns via backend index fallback when requested', async () => {
    // Event scanner only sees recent campaign 202 (due to lookback limit)
    vi.spyOn(eventsModule, 'loadRecentEscrowEvents').mockResolvedValue([
      {
        id: '1',
        ledger: 180000,
        ledgerClosedAt: '2026-08-28T00:00:00Z',
        name: 'CampaignCreated',
        campaignId: '202',
        values: [],
      },
    ]);

    // Backend index contains historical campaign 101 that was created before lookback window
    vi.spyOn(apiModule, 'getCampaigns').mockResolvedValue([
      {
        id: '101',
        farmer: 'GFARMER00000000000000000000000000000000000000000000000A1',
        title: 'Old Campaign',
        description: 'Old',
        targetAmount: '10000',
        tokenAddress: null,
        deadline: null,
        status: 'Funding',
        totalFunded: '0',
        escrowContract: 'CESCROW',
        trancheCount: null,
        harvestOutcome: null,
        harvestReportedAt: null,
        refundable: null,
        createdAt: '1789000000',
        updatedAt: '2026-07-15T10:00:00.000Z',
      },
    ]);

    const { result } = renderHook(
      () => useAdminCampaigns({ useBackendFallback: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const ids = result.current.data?.map((c) => c.id);
    expect(ids).toContain('202');
    expect(ids).toContain('101');
  });
});
