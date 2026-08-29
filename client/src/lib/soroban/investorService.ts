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
