import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as contractClient from '../../lib/soroban/contractClient';
import { contractQueryKeys } from './queryKeys';

vi.mock('../../lib/soroban/contractClient', () => ({
  getEscrowClient: vi.fn(() => Promise.resolve({})),
  invokeContractWrite: vi.fn(),
}));

const WALLET = {
  publicKey: 'GINVESTOR000000000000000000000000000000000000000000000B2',
  isConnected: true,
  isConnecting: false,
  error: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  clearError: vi.fn(),
  signTransaction: vi.fn(),
};

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => WALLET,
}));

const notifySuccess = vi.fn();
const notifyError = vi.fn();
vi.mock('./mutationToasts', () => ({
  useMutationToasts: () => ({ notifySuccess, notifyError }),
}));

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useClaimRefund / useClaimReturn', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.mocked(contractClient.invokeContractWrite).mockResolvedValue(undefined);
  });

  it('calls claim_refund on the escrow contract and invalidates live queries', async () => {
    const { useClaimRefund } = await import('./useEscrowMutations');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useClaimRefund(), {
      wrapper: wrapper(queryClient),
    });

    const returned = await result.current.mutateAsync({
      campaignId: '7',
      investor: WALLET.publicKey,
    });

    expect(contractClient.invokeContractWrite).toHaveBeenCalledWith(
      expect.any(Promise),
      'claim_refund',
      {
        campaign_id: 7n,
        investor: WALLET.publicKey,
      },
      WALLET,
    );
    expect(returned).toBeUndefined();
    expect(typeof returned).not.toBe('string');
    expect(notifySuccess).toHaveBeenCalled();

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contractQueryKeys.campaign('7'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contractQueryKeys.contribution('7', WALLET.publicKey),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contractQueryKeys.investorPortfolio(WALLET.publicKey),
      });
    });
  });

  it('calls claim_return on the escrow contract without fabricating a tx hash', async () => {
    const { useClaimReturn } = await import('./useEscrowMutations');

    const { result } = renderHook(() => useClaimReturn(), {
      wrapper: wrapper(queryClient),
    });

    const returned = await result.current.mutateAsync({
      campaignId: '42',
      investor: WALLET.publicKey,
    });

    expect(contractClient.invokeContractWrite).toHaveBeenCalledWith(
      expect.any(Promise),
      'claim_return',
      {
        campaign_id: 42n,
        investor: WALLET.publicKey,
      },
      WALLET,
    );
    expect(returned).toBeUndefined();
    expect(JSON.stringify(returned ?? null)).not.toMatch(/0x[0-9a-f]{16}/i);
    expect(notifySuccess).toHaveBeenCalled();
  });

  it('surfaces contract failures through the mutation error toast', async () => {
    vi.mocked(contractClient.invokeContractWrite).mockRejectedValue(
      new Error('nothing to refund'),
    );
    const { useClaimRefund } = await import('./useEscrowMutations');

    const { result } = renderHook(() => useClaimRefund(), {
      wrapper: wrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({
        campaignId: '7',
        investor: WALLET.publicKey,
      }),
    ).rejects.toThrow('nothing to refund');

    await waitFor(() => {
      expect(notifyError).toHaveBeenCalled();
    });
  });
});
