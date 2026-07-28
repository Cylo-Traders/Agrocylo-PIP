import { describe, it, expect } from 'vitest';
import { toUserFacingError } from './userFacingError';

describe('toUserFacingError', () => {
  it('maps known on-chain panic text to a friendly message', () => {
    expect(
      toUserFacingError(
        new Error(
          'HostError: panicked at campaign not accepting contributions',
        ),
      ),
    ).toBe('This campaign is not currently accepting contributions.');
  });

  it('maps wallet-cancel style errors', () => {
    expect(toUserFacingError(new Error('User declined to sign'))).toBe(
      'Wallet signature was cancelled.',
    );
  });

  it('falls back to the first diagnostic line for unknown HostErrors', () => {
    expect(
      toUserFacingError(
        new Error(
          'HostError: Error(Contract, #12)\nlong diagnostic dump that should be truncated',
        ),
      ),
    ).toBe('HostError: Error(Contract, #12)');
  });

  it('reads message from plain RPC-shaped objects', () => {
    expect(
      toUserFacingError({ message: 'failed to fetch from RPC endpoint' }),
    ).toBe('Network request failed. Check your connection and try again.');
  });
});
