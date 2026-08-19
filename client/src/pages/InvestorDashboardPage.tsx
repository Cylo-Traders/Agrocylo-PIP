import React, { useState } from 'react';
import {
  getInvestorPortfolio,
  calculatePortfolioStats,
  claimRefund,
  claimReturn,
  type FundedInvestment,
} from '../lib/soroban/investorService';
import { InvestorSummaryStats } from '../components/investor/InvestorSummaryStats';
import { InvestmentCard } from '../components/investor/InvestmentCard';
import { useToast } from '../context/ToastContext';
import { DashboardRowsSkeleton } from '../components/ui/Skeleton/Skeleton';

export const InvestorDashboardPage: React.FC = () => {
  const toast = useToast();
  const [walletAddress] = useState<string>('GDF4...M9XZ');
  const [investments, setInvestments] = useState<FundedInvestment[] | null>(
    null,
  );

  // Simulate the async portfolio fetch that a live RPC/indexer hook will use.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setInvestments(getInvestorPortfolio(walletAddress));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [walletAddress]);

  const stats = calculatePortfolioStats(investments ?? []);

  const handleClaimRefund = async (campaignId: string) => {
    const res = await claimRefund(campaignId, walletAddress);

    if (!res.success) {
      toast.error(
        'Could not claim refund',
        res.error || 'Failed to claim refund',
      );
      return;
    }

    setInvestments((prev) =>
      (prev ?? []).map((inv) =>
        inv.campaignId === campaignId ? { ...inv, claimed: true } : inv,
      ),
    );
    toast.success(
      'Refund claimed',
      `Successfully claimed refund of $${res.claimedAmount?.toLocaleString()}.`,
    );
  };

  const handleClaimReturn = async (campaignId: string) => {
    const res = await claimReturn(campaignId, walletAddress);

    if (!res.success) {
      toast.error(
        'Could not claim return',
        res.error || 'Failed to claim return',
      );
      return;
    }

    setInvestments((prev) =>
      (prev ?? []).map((inv) =>
        inv.campaignId === campaignId ? { ...inv, claimed: true } : inv,
      ),
    );
    toast.success(
      'Return claimed',
      `Successfully claimed return payout of $${res.claimedAmount?.toLocaleString()}.`,
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-soil-200 dark:border-soil-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-soil-900 dark:text-soil-50 tracking-tight">
            Investor Dashboard
          </h1>
          <p className="text-soil-500 dark:text-soil-400 mt-1">
            Track funded campaigns, claimable returns, and pro-rata refunds.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-soil-100 dark:bg-soil-800/80 px-4 py-2 rounded-xl text-xs font-mono text-soil-700 dark:text-soil-300">
          <span
            className="w-2.5 h-2.5 rounded-full bg-leaf-500 animate-pulse"
            aria-hidden="true"
          />
          <span>Connected: {walletAddress}</span>
        </div>
      </div>

      {investments === null ? (
        <DashboardRowsSkeleton count={3} />
      ) : (
        <>
          <InvestorSummaryStats
            stats={stats}
            totalCampaigns={investments.length}
          />

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-soil-900 dark:text-soil-50">
              Your Contributions ({investments.length})
            </h2>

            {investments.length === 0 ? (
              <div className="space-y-3 rounded-campaign border border-dashed border-soil-300 bg-white p-12 text-center dark:border-soil-800 dark:bg-soil-900">
                <div
                  className="w-12 h-12 rounded-full bg-soil-100 dark:bg-soil-800 text-soil-600 dark:text-soil-400 flex items-center justify-center mx-auto text-xl font-bold"
                  aria-hidden="true"
                >
                  📂
                </div>
                <h3 className="text-lg font-semibold text-soil-900 dark:text-soil-50">
                  No Funded Investments Found
                </h3>
                <p className="text-sm text-soil-600 dark:text-soil-400 max-w-md mx-auto">
                  You haven&apos;t contributed to any PIP campaigns yet. Browse
                  active campaigns to start investing.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {investments.map((inv) => (
                  <InvestmentCard
                    key={inv.campaignId}
                    investment={inv}
                    onClaimRefund={handleClaimRefund}
                    onClaimReturn={handleClaimReturn}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default InvestorDashboardPage;
