import { describe, it, expect } from 'vitest';
import {
  validateContribution,
  calculateOwnershipShare,
  parseContributionAmount,
} from '../lib/soroban/campaignService';

describe('parseContributionAmount', () => {
  it('parses whole-number strings as bigint contract units', () => {
    expect(parseContributionAmount('500')).toBe(500n);
    expect(parseContributionAmount(' 1000 ')).toBe(1000n);
  });

  it('rejects decimals, signs, scientific notation, and empty input', () => {
    expect(parseContributionAmount('')).toBeNull();
    expect(parseContributionAmount('0.5')).toBeNull();
    expect(parseContributionAmount('-50')).toBeNull();
    expect(parseContributionAmount('1e3')).toBeNull();
    expect(parseContributionAmount('500.00')).toBeNull();
    expect(parseContributionAmount('abc')).toBeNull();
  });
});

describe('validateContribution', () => {
  it('accepts a positive amount within the remaining target', () => {
    expect(validateContribution(500, 1000)).toEqual({ valid: true });
    expect(validateContribution(500n, 1000n)).toEqual({ valid: true });
    expect(validateContribution('500', 1000)).toEqual({ valid: true });
  });

  it('rejects zero and negative amounts', () => {
    const zeroRes = validateContribution(0, 1000);
    expect(zeroRes.valid).toBe(false);
    expect(zeroRes.error).toBe('Contribution amount must be greater than zero');

    expect(validateContribution(-50, 1000).valid).toBe(false);
    expect(validateContribution(0n, 1000n).valid).toBe(false);
  });

  it('rejects amounts that exceed the remaining target', () => {
    const exceedsRes = validateContribution(1500, 1000);
    expect(exceedsRes.valid).toBe(false);
    expect(exceedsRes.error).toMatch(/exceeds remaining target/);
  });

  it('rejects non-integer amounts', () => {
    expect(validateContribution(12.5, 1000).valid).toBe(false);
    expect(validateContribution('12.5', 1000).valid).toBe(false);
  });
});

describe('calculateOwnershipShare', () => {
  it('returns a percentage of the campaign target', () => {
    expect(calculateOwnershipShare(2500, 10000)).toBe(25);
    expect(calculateOwnershipShare(5000, 10000)).toBe(50);
    expect(calculateOwnershipShare(0, 10000)).toBe(0);
  });
});
