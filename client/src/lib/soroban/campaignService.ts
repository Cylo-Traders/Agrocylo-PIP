export interface FundCampaignResult {
  success: boolean;
  txHash?: string;
  newTotalRaised?: number;
  newRemainingTarget?: number;
  error?: string;
}

/**
 * Parses a contribution amount as a whole-number contract unit (`i128`/`bigint`).
 * Rejects decimals, signs, scientific notation, and empty strings — the escrow
 * `fund_campaign` amount is a raw integer, same as create-campaign / admin forms.
 */
export function parseContributionAmount(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

function toContractUnits(value: bigint | number): bigint {
  if (typeof value === 'bigint') return value < 0n ? 0n : value;
  if (!Number.isFinite(value) || value <= 0) return 0n;
  return BigInt(Math.trunc(value));
}

export function validateContribution(
  amount: bigint | number | string,
  remainingTarget: bigint | number,
): { valid: boolean; error?: string } {
  let parsed: bigint | null;

  if (typeof amount === 'bigint') {
    parsed = amount;
  } else if (typeof amount === 'string') {
    parsed = parseContributionAmount(amount);
    if (parsed === null) {
      return {
        valid: false,
        error: 'Contribution amount must be a whole number greater than zero',
      };
    }
  } else if (!Number.isFinite(amount) || amount <= 0) {
    return {
      valid: false,
      error: 'Contribution amount must be greater than zero',
    };
  } else if (!Number.isInteger(amount)) {
    return {
      valid: false,
      error: 'Contribution amount must be a whole number greater than zero',
    };
  } else {
    parsed = BigInt(amount);
  }

  if (parsed <= 0n) {
    return {
      valid: false,
      error: 'Contribution amount must be greater than zero',
    };
  }

  const remaining = toContractUnits(remainingTarget);
  if (parsed > remaining) {
    return {
      valid: false,
      error: `Contribution amount (${parsed}) exceeds remaining target (${remaining})`,
    };
  }

  return { valid: true };
}

export function calculateOwnershipShare(
  amount: number,
  totalTarget: number,
): number {
  if (totalTarget <= 0 || amount <= 0) return 0;
  const share = (amount / totalTarget) * 100;
  return Math.min(100, Math.round(share * 100) / 100);
}
