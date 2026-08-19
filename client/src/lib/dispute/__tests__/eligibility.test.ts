import { describe, it, expect } from 'vitest';
import {
  evaluateDisputeEligibility,
  validateDisputeReason,
  DISPUTE_REASON_MAX_LENGTH,
} from '../eligibility';
import type { CampaignStatusTag } from '../../soroban/types';

const FARMER = 'GFARMER00000000000000000000000000000000000000000000000AA';
const ADMIN = 'GADMIN000000000000000000000000000000000000000000000000BB';
const INVESTOR = 'GINVESTOR0000000000000000000000000000000000000000000000CC';
const STRANGER = 'GSTRANGER0000000000000000000000000000000000000000000000DD';

const base = {
  status: 'Funding' as CampaignStatusTag,
  walletAddress: STRANGER,
  farmer: FARMER,
  admin: ADMIN,
  contribution: 0n,
};

describe('evaluateDisputeEligibility', () => {
  it('allows the campaign farmer', () => {
    const result = evaluateDisputeEligibility({
      ...base,
      walletAddress: FARMER,
    });
    expect(result.eligible).toBe(true);
    expect(result.role).toBe('farmer');
  });

  it('allows the escrow admin', () => {
    const result = evaluateDisputeEligibility({
      ...base,
      walletAddress: ADMIN,
    });
    expect(result.eligible).toBe(true);
    expect(result.role).toBe('admin');
  });

  it('allows a wallet with a non-zero contribution', () => {
    const result = evaluateDisputeEligibility({
      ...base,
      walletAddress: INVESTOR,
      contribution: 1n,
    });
    expect(result.eligible).toBe(true);
    expect(result.role).toBe('contributor');
  });

  it('rejects a wallet with a zero contribution', () => {
    const result = evaluateDisputeEligibility({
      ...base,
      walletAddress: INVESTOR,
      contribution: 0n,
    });
    expect(result.eligible).toBe(false);
    expect(result.role).toBeNull();
  });

  it('rejects a wallet whose contribution is still unknown', () => {
    const result = evaluateDisputeEligibility({
      ...base,
      walletAddress: INVESTOR,
      contribution: undefined,
    });
    expect(result.eligible).toBe(false);
  });

  it('rejects when no wallet is connected, even for a disputable status', () => {
    const result = evaluateDisputeEligibility({
      ...base,
      walletAddress: null,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/connect your wallet/i);
  });

  it.each<CampaignStatusTag>(['Active', 'Funding', 'Funded'])(
    'allows an eligible caller while status is %s',
    (status) => {
      const result = evaluateDisputeEligibility({
        ...base,
        status,
        walletAddress: FARMER,
      });
      expect(result.eligible).toBe(true);
    },
  );

  it.each<CampaignStatusTag>([
    'InProduction',
    'Harvested',
    'Disputed',
    'Resolved',
    'Settled',
    'Failed',
  ])('blocks even the farmer once status is %s', (status) => {
    const result = evaluateDisputeEligibility({
      ...base,
      status,
      walletAddress: FARMER,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/only be opened/i);
  });

  it('blocks while the campaign status is still loading', () => {
    const result = evaluateDisputeEligibility({
      ...base,
      status: undefined,
      walletAddress: FARMER,
    });
    expect(result.eligible).toBe(false);
  });

  it('does not grant admin rights when the admin address is unknown', () => {
    const result = evaluateDisputeEligibility({
      ...base,
      walletAddress: ADMIN,
      admin: undefined,
    });
    expect(result.eligible).toBe(false);
  });
});

describe('validateDisputeReason', () => {
  it('rejects an empty reason', () => {
    expect(validateDisputeReason('').valid).toBe(false);
  });

  it('rejects a whitespace-only reason', () => {
    const result = validateDisputeReason('   \n\t  ');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it('accepts a non-empty reason', () => {
    expect(validateDisputeReason('Harvest was never delivered.').valid).toBe(
      true,
    );
  });

  it('rejects a reason over the length cap', () => {
    const result = validateDisputeReason('x'.repeat(DISPUTE_REASON_MAX_LENGTH + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/characters or fewer/i);
  });

  it('accepts a reason exactly at the length cap', () => {
    expect(
      validateDisputeReason('x'.repeat(DISPUTE_REASON_MAX_LENGTH)).valid,
    ).toBe(true);
  });
});
