export type CampaignStatus =
  'Active' | 'Funding' | 'Resolved' | 'Failed' | 'Settled';

export interface FundedInvestment {
  campaignId: string;
  title: string;
  amountContributed: number;
  status: CampaignStatus;
  claimableAmount: number;
  claimed: boolean;
  walletAddress: string;
  fundedAt: string;
}

export interface PortfolioStats {
  totalInvested: number;
  totalClaimed: number;
  totalPending: number;
}

const MOCK_INVESTMENTS: FundedInvestment[] = [
  {
    campaignId: 'camp-101',
    title: 'Organic Maize Irrigation & Harvesting PIP',
    amountContributed: 2500,
    status: 'Funding',
    claimableAmount: 0,
    claimed: false,
    walletAddress: 'GDF4...M9XZ',
    fundedAt: '2026-07-15T10:00:00Z',
  },
  {
    campaignId: 'camp-102',
    title: 'Solar-Powered Cold Chain Logistics PIP',
    amountContributed: 5000,
    status: 'Settled',
    claimableAmount: 6250,
    claimed: false,
    walletAddress: 'GDF4...M9XZ',
    fundedAt: '2026-06-01T14:30:00Z',
  },
  {
    campaignId: 'camp-103',
    title: 'Bio-Organic Fertilizer Expansion PIP',
    amountContributed: 1500,
    status: 'Failed',
    claimableAmount: 1500,
    claimed: false,
    walletAddress: 'GDF4...M9XZ',
    fundedAt: '2026-05-20T09:15:00Z',
  },
];

export function getInvestorPortfolio(
  walletAddress: string,
): FundedInvestment[] {
  if (!walletAddress) return [];
  // Strict wallet filtering
  return MOCK_INVESTMENTS.filter(
    (inv) => inv.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
  );
}

export function calculatePortfolioStats(
  investments: FundedInvestment[],
): PortfolioStats {
  return investments.reduce(
    (acc, inv) => {
      acc.totalInvested += inv.amountContributed;
      if (inv.claimed) {
        acc.totalClaimed += inv.claimableAmount;
      } else {
        acc.totalPending += inv.claimableAmount;
      }
      return acc;
    },
    { totalInvested: 0, totalClaimed: 0, totalPending: 0 },
  );
}

export async function claimRefund(
  campaignId: string,
  walletAddress: string,
): Promise<{
  success: boolean;
  txHash?: string;
  claimedAmount?: number;
  error?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const item = MOCK_INVESTMENTS.find(
    (inv) =>
      inv.campaignId === campaignId &&
      inv.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
  );

  if (!item) {
    return { success: false, error: 'Investment record not found' };
  }

  if (item.status !== 'Resolved' && item.status !== 'Failed') {
    return {
      success: false,
      error: `Cannot claim refund for campaign in '${item.status}' status`,
    };
  }

  if (item.claimed) {
    return { success: false, error: 'Refund has already been claimed' };
  }

  item.claimed = true;
  const txHash = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('')}`;

  return {
    success: true,
    txHash,
    claimedAmount: item.claimableAmount,
  };
}

export async function claimReturn(
  campaignId: string,
  walletAddress: string,
): Promise<{
  success: boolean;
  txHash?: string;
  claimedAmount?: number;
  error?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const item = MOCK_INVESTMENTS.find(
    (inv) =>
      inv.campaignId === campaignId &&
      inv.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
  );

  if (!item) {
    return { success: false, error: 'Investment record not found' };
  }

  if (item.status !== 'Settled') {
    return {
      success: false,
      error: `Cannot claim return for campaign in '${item.status}' status`,
    };
  }

  if (item.claimed) {
    return { success: false, error: 'Return payout has already been claimed' };
  }

  item.claimed = true;
  const txHash = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('')}`;

  return {
    success: true,
    txHash,
    claimedAmount: item.claimableAmount,
  };
}
