export interface FundCampaignParams {
  campaignId: string;
  amount: number;
  walletAddress: string;
}

export interface FundCampaignResult {
  success: boolean;
  txHash?: string;
  newTotalRaised?: number;
  newRemainingTarget?: number;
  error?: string;
}

export function validateContribution(
  amount: number | string,
  remainingTarget: number,
): { valid: boolean; error?: string } {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount) || numAmount <= 0) {
    return {
      valid: false,
      error: 'Contribution amount must be greater than zero',
    };
  }

  if (numAmount > remainingTarget) {
    return {
      valid: false,
      error: `Contribution amount (${numAmount}) exceeds remaining target (${remainingTarget})`,
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

export async function fundCampaign(
  params: FundCampaignParams,
  currentRaised = 0,
  targetAmount = 10000,
): Promise<FundCampaignResult> {
  const remainingTarget = Math.max(0, targetAmount - currentRaised);
  const validation = validateContribution(params.amount, remainingTarget);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Simulate network delay / Soroban transaction submission
  await new Promise((resolve) => setTimeout(resolve, 600));

  // Generate deterministic mock txHash for successful funding transaction
  const txHash = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('')}`;

  const newTotalRaised = currentRaised + params.amount;
  const newRemaining = Math.max(0, targetAmount - newTotalRaised);

  return {
    success: true,
    txHash,
    newTotalRaised,
    newRemainingTarget: newRemaining,
  };
}
