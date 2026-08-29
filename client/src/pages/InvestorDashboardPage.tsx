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

const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign';

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
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-soil-200 pb-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-soil-950 tracking-tight">Investor Dashboard</h1>
          <p className="mt-1 text-body-sm text-soil-500">
            Track funded campaigns, claimable returns, and pro-rata refunds.
          </p>
        </div>

        {isConnected && publicKey ? (
          <div className="flex items-center gap-2 rounded-campaign bg-soil-100 px-4 py-2 font-mono text-caption text-soil-700">
            <span
              className="h-2.5 w-2.5 animate-pulse rounded-full bg-status-resolved"
              aria-hidden="true"
            />
            <span>Connected: {publicKey}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-campaign border border-status-harvested/20 bg-status-harvested-light px-4 py-2 text-caption font-medium text-status-harvested-dark">
            <span>Wallet Disconnected</span>
          </div>
        )}
      </div>

      {!isConnected || !publicKey ? (
        <div className={`${cardClass} p-12 text-center`}>
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-harvested-light text-xl font-bold text-status-harvested-dark"
            aria-hidden="true"
          >
            🔒
          </div>
          <h2 className="mt-4 text-h4 text-soil-900">Connect Your Wallet</h2>
          <p className="mx-auto mt-2 max-w-md text-body-sm text-soil-500">
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
            <h2 className="text-h4 text-soil-900">
              Your Contributions ({(investments ?? []).length})
            </h2>

            {(investments ?? []).length === 0 ? (
              <div className="rounded-campaign border border-dashed border-soil-300 bg-white p-12 text-center">
                <div
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-soil-100 text-xl font-bold text-soil-600"
                  aria-hidden="true"
                >
                  📂
                </div>
                <h3 className="mt-3 text-h4 text-soil-900">
                  No Funded Investments Found
                </h3>
                <p className="mx-auto mt-2 max-w-md text-body-sm text-soil-500">
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
