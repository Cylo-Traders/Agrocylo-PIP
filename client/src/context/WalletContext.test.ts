import { afterEach, describe, expect, it, vi } from 'vitest';

const PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

async function loadWalletSignOptions() {
  vi.resetModules();
  const module = await import('./WalletContext');
  return module.walletSignOptions;
}

describe('wallet signing network configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the configured Soroban network passphrase for wallet signing', async () => {
    vi.stubEnv('VITE_SOROBAN_NETWORK_PASSPHRASE', PUBLIC_PASSPHRASE);

    const walletSignOptions = await loadWalletSignOptions();

    expect(walletSignOptions()).toEqual({
      networkPassphrase: PUBLIC_PASSPHRASE,
    });
  });

  it('keeps the default Testnet passphrase when no override is configured', async () => {
    vi.stubEnv('VITE_SOROBAN_NETWORK_PASSPHRASE', '');

    const walletSignOptions = await loadWalletSignOptions();

    expect(walletSignOptions()).toEqual({
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
  });
});