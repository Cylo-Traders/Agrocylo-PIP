import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  isConnected,
  getAddress,
  getNetworkDetails,
  signTransaction as freighterSign,
} from '@stellar/freighter-api';
import { NETWORK_PASSPHRASE } from '../lib/soroban/config';

const STORAGE_KEY = 'agrocylo:wallet:address';

interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

export function walletSignOptions() {
  return { networkPassphrase: NETWORK_PASSPHRASE };
}

const WalletContext = createContext<WalletState | null>(null);

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return ctx;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export { truncateAddress };

/**
 * Compares the connected wallet's active network against the app's
 * configured NETWORK_PASSPHRASE. Returns a human-readable warning if they
 * differ, or null if they match (or if the check itself fails — Freighter's
 * own signature request is the final guard in that case).
 */
async function describeNetworkMismatch(): Promise<string | null> {
  try {
    const details = await getNetworkDetails();
    if (
      details.networkPassphrase &&
      details.networkPassphrase !== NETWORK_PASSPHRASE
    ) {
      return `Your wallet is connected to "${details.network}" but this app is configured for a different network. Switch your wallet's network to continue.`;
    }
    return null;
  } catch {
    // If Freighter doesn't support the check (older versions) or it fails,
    // don't block the user here — an actual mismatch will still be caught
    // when Freighter is asked to sign against NETWORK_PASSPHRASE.
    return null;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const connectedResult = await isConnected();
      if (!connectedResult.isConnected) {
        setError(
          'No Stellar wallet detected. Please install Freighter or another supported wallet extension.',
        );
        return;
      }
      const addrResult = await getAddress();
      setPublicKey(addrResult.address);
      try {
        localStorage.setItem(STORAGE_KEY, addrResult.address);
      } catch {
        // localStorage may be unavailable (SSR, private browsing, etc.)
      }
      const mismatchWarning = await describeNetworkMismatch();
      if (mismatchWarning) {
        setError(mismatchWarning);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('reject')) {
        setError(
          'Connection rejected. Please approve the prompt in your wallet.',
        );
      } else {
        setError('Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }
      const result = await freighterSign(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      return result.signedTxXdr;
    },
    [publicKey],
  );

  // Validate persisted address on mount — silently disconnect if invalid.
  // Mount-only: publicKey is read inside but intentionally not a trigger.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    (async () => {
      try {
        const connectedResult = await isConnected();
        if (!connectedResult.isConnected && !cancelled) {
          setPublicKey(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Freighter not available — clear persisted state.
        if (!cancelled) {
          setPublicKey(null);
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            // Ignore.
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const value = useMemo<WalletState>(
    () => ({
      publicKey,
      isConnected: publicKey !== null,
      isConnecting,
      error,
      connect,
      disconnect,
      clearError,
      signTransaction,
    }),
    [
      publicKey,
      isConnecting,
      error,
      connect,
      disconnect,
      clearError,
      signTransaction,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
