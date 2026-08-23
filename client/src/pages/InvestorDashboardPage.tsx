import React from 'react';
import { useWallet } from '../context/WalletContext';
import { useInvestorPortfolio } from '../hooks/useInvestorPortfolio';
import {
  useClaimRefund,
  useClaimReturn,
} from '../hooks/contract/useEscrowMutations';
import { calculatePortfolioStats } from '../lib/soroban/investorService';
import { InvestorSummaryStats } from '../components/investor/InvestorSummaryStats';
import { InvestmentCard } from '../components/investor/InvestmentCard';
import { DashboardRowsSkeleton } from '../components/ui/Skeleton/Skeleton';

export const InvestorDashboardPage: React.FC = () => {
  const { isConnected, publicKey } = useWallet();
  const { data: investments, isLoading } = useInvestorPortfolio(
    isConnected ? (publicKey ?? undefined) : undefined,
  );

  const claimRefundMutation = useClaimRefund();
  const claimReturnMutation = useClaimReturn();

  const handleClaimRefund = async (campaignId: string) => {
    if (!publicKey) return;
    await claimRefundMutation.mutateAsync({
      campaignId,
      investor: publicKey,
    });
  };

  const handleClaimReturn = async (campaignId: string) => {
    if (!publicKey) return;
    await claimReturnMutation.mutateAsync({
      campaignId,
      investor: publicKey,
    });
  };

  const stats = calculatePortfolioStats(investments ?? []);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Investor Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Track funded campaigns, claimable returns, and pro-rata refunds.
          </p>
        </div>

        {isConnected && publicKey ? (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-4 py-2 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300">
            <span
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"
              aria-hidden="true"
            />
            <span>Connected: {publicKey}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-4 py-2 rounded-xl text-xs font-medium text-amber-800 dark:text-amber-300">
            <span>Wallet Disconnected</span>
          </div>
        )}
      </div>

      {!isConnected || !publicKey ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-sm">
          <div
            className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto text-xl font-bold"
            aria-hidden="true"
          >
            🔒
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Connect Your Wallet
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Connect your Soroban-compatible wallet to view your active
            investments, claimable returns, and refund balances.
          </p>
        </div>
      ) : isLoading ? (
        <DashboardRowsSkeleton count={3} />
      ) : (
        <>
          <InvestorSummaryStats
            stats={stats}
            totalCampaigns={(investments ?? []).length}
          />

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Your Contributions ({(investments ?? []).length})
            </h2>

            {(investments ?? []).length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <div
                  className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center mx-auto text-xl font-bold"
                  aria-hidden="true"
                >
                  📂
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  No Funded Investments Found
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  You haven&apos;t contributed to any PIP campaigns yet. Browse
                  active campaigns to start investing.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {(investments ?? []).map((inv) => (
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
