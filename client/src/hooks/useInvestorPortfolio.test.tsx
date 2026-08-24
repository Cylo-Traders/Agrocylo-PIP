import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Campaign } from '../lib/soroban/types';
import * as investorService from '../lib/soroban/investorService';

const WALLET = 'GINVESTOR000000000000000000000000000000000000000000000B2';

vi.mock('../lib/soroban/config', () => ({
  RPC_URL: 'https://rpc.test',
  ESCROW_CONTRACT_ID: 'CESCROW',
  isEscrowConfigured: () => true,
  isRegistryConfigured: () => false,
}));

const loadRecentEscrowEvents = vi.fn();
vi.mock('../lib/soroban/events', () => ({
  loadRecentEscrowEvents: (...args: unknown[]) =>
    loadRecentEscrowEvents(...args),
}));

const getEscrowClient = vi.fn();
const contractMethod = vi.fn();
vi.mock('../lib/soroban/contractClient', () => ({
  getEscrowClient: () => getEscrowClient(),
  contractMethod: (...args: unknown[]) => contractMethod(...args),
}));

vi.mock('../lib/contracts/registry', () => ({
  getCampaign: vi.fn(),
}));

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const FAILED_CAMPAIGN: Campaign = {
  farmer: 'GFARMER',
  target_amount: 1500n,
  token_address: 'CTOKEN',
  deadline: 0n,
  harvest_metadata: 'fertilizer',
  total_funded: 1500n,
  released: 0n,
  refundable: 1500n,
  returnable: 0n,
  status: { tag: 'Failed' },
};

describe('useInvestorPortfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadRecentEscrowEvents.mockResolvedValue([
      {
        id: 'e1',
        ledger: 1,
        ledgerClosedAt: '2026-01-01T00:00:00Z',
        campaignId: '7',
        name: 'ContribReceived',
        values: [WALLET, 1_700_000_000, 1500n],
      },
    ]);
    getEscrowClient.mockResolvedValue({});
    contractMethod.mockImplementation((_client: unknown, method: string) => {
      if (method === 'get_campaign') {
        return async () => ({ result: FAILED_CAMPAIGN });
      }
      if (method === 'get_contribution') {
        return async () => ({ result: 1500n });
      }
      throw new Error(`unexpected method ${method}`);
    });
  });

  it('builds the portfolio from escrow events and contract reads, not MOCK_INVESTMENTS', async () => {
    const getPortfolioSpy = vi.spyOn(investorService, 'getInvestorPortfolio');
    const { useInvestorPortfolio } = await import('./useInvestorPortfolio');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useInvestorPortfolio(WALLET), {
      wrapper: wrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(loadRecentEscrowEvents).toHaveBeenCalled();
    expect(getPortfolioSpy).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([
      expect.objectContaining({
        campaignId: '7',
        walletAddress: WALLET,
        amountContributed: 1500,
        status: 'Failed',
        claimed: false,
        title: 'fertilizer',
      }),
    ]);
    expect(JSON.stringify(result.current.data)).not.toMatch(/0x[0-9a-f]{16}/i);
    expect(JSON.stringify(result.current.data)).not.toMatch(/camp-101/);
  });

  it('does not fetch when no wallet is connected', async () => {
    const { useInvestorPortfolio } = await import('./useInvestorPortfolio');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useInvestorPortfolio(null), {
      wrapper: wrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(loadRecentEscrowEvents).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});
