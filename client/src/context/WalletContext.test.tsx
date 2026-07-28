import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useWallet, WalletProvider } from './WalletContext';

const mockIsConnected = vi.fn();
const mockGetAddress = vi.fn();
const mockGetNetworkDetails = vi.fn();
const mockSignTransaction = vi.fn();

vi.mock('@stellar/freighter-api', () => ({
  isConnected: (...args: unknown[]) => mockIsConnected(...args),
  getAddress: (...args: unknown[]) => mockGetAddress(...args),
  getNetworkDetails: (...args: unknown[]) => mockGetNetworkDetails(...args),
  signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
}));

// The app's configured passphrase, as it would be resolved from
// VITE_SOROBAN_NETWORK_PASSPHRASE via lib/soroban/config.ts. Deliberately not
// the Testnet default, so this test only passes if signTransaction actually
// reads it from config rather than falling back to a hardcoded literal.
//
// NOTE: vi.mock factories are hoisted above other top-level code, so the
// literal is duplicated here rather than shared via a const — referencing an
// outer const from inside vi.mock throws at hoist time.
const CONFIGURED_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

vi.mock('../lib/soroban/config', () => ({
  NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015',
}));

const MOCK_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function wrapper({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}

describe('WalletContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockGetAddress.mockResolvedValue({ address: MOCK_ADDRESS });
    mockGetNetworkDetails.mockResolvedValue({
      network: 'PUBLIC',
      networkPassphrase: CONFIGURED_PASSPHRASE,
      networkUrl: 'https://horizon.stellar.org',
      sorobanRpcUrl: 'https://soroban-rpc.stellar.org',
    });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: 'signed-xdr' });
  });

  it('signs with the app-configured NETWORK_PASSPHRASE, not a hardcoded literal', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => expect(result.current.publicKey).toBe(MOCK_ADDRESS));

    await act(async () => {
      await result.current.signTransaction('some-xdr');
    });

    expect(mockSignTransaction).toHaveBeenCalledWith('some-xdr', {
      networkPassphrase: CONFIGURED_PASSPHRASE,
    });
    // Guard against ever reintroducing the hardcoded Testnet literal.
    expect(mockSignTransaction).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        networkPassphrase: 'Test SDF Network ; September 2015',
      }),
    );
  });

  it('surfaces a clear error when the wallet network does not match the app config', async () => {
    mockGetNetworkDetails.mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
      networkUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    });

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatch(/wallet.*connected to.*TESTNET/i);
    // Connection itself still succeeds — this is a warning, not a hard block.
    expect(result.current.publicKey).toBe(MOCK_ADDRESS);
  });

  it('does not surface a mismatch warning when wallet and app network agree', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => expect(result.current.publicKey).toBe(MOCK_ADDRESS));
    expect(result.current.error).toBeNull();
  });

  it('does not block connecting if the network-details check itself fails', async () => {
    mockGetNetworkDetails.mockRejectedValue(new Error('not supported'));

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => expect(result.current.publicKey).toBe(MOCK_ADDRESS));
    expect(result.current.error).toBeNull();
  });
});
