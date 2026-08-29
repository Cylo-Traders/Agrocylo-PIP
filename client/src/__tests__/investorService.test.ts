import { describe, expect, it } from 'vitest';
import { calculatePortfolioStats } from '../lib/soroban/investorService';
import type { FundedInvestment } from '../lib/soroban/investorService';

describe('calculatePortfolioStats', () => {
  it('calculates correct stats for investments', () => {
    const investments: FundedInvestment[] = [
      {
        campaignId: '1',
        title: 'Campaign 1',
        amountContributed: 2500,
        status: 'Funding',
        claimableAmount: 0,
        claimed: false,
        walletAddress: 'GDF4...M9XZ',
        fundedAt: '2026-08-01',
      },
      {
        campaignId: '2',
        title: 'Campaign 2',
        amountContributed: 5000,
        status: 'Resolved',
        claimableAmount: 6250,
        claimed: false,
        walletAddress: 'GDF4...M9XZ',
        fundedAt: '2026-08-02',
      },
      {
        campaignId: '3',
        title: 'Campaign 3',
        amountContributed: 1500,
        status: 'Failed',
        claimableAmount: 1500,
        claimed: true,
        walletAddress: 'GDF4...M9XZ',
        fundedAt: '2026-08-03',
      },
    ];

    const stats = calculatePortfolioStats(investments);
    expect(stats.totalInvested).toBe(9000);
    expect(stats.totalClaimed).toBe(1500);
    expect(stats.totalPending).toBe(6250);
  });

  it('handles empty investments array', () => {
    const stats = calculatePortfolioStats([]);
    expect(stats.totalInvested).toBe(0);
    expect(stats.totalClaimed).toBe(0);
    expect(stats.totalPending).toBe(0);
  });
});
