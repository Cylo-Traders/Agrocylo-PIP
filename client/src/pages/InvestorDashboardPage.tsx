import { useWallet, truncateAddress } from '../context/WalletContext';
import { useClaimRefund, useClaimReturn } from '../hooks/contract';
import { useInvestorPortfolio } from '../hooks/useInvestorPortfolio';
import { calculatePortfolioStats } from '../lib/soroban/investorService';
import { isEscrowConfigured } from '../lib/soroban/config';
import { InvestorSummaryStats } from '../components/investor/InvestorSummaryStats';
import { InvestmentCard } from '../components/investor/InvestmentCard';
import { DashboardRowsSkeleton } from '../components/ui/Skeleton/Skeleton';

export function InvestorDashboardPage() {
  const wallet = useWallet();
  const configured = isEscrowConfigured();
  const portfolioQuery = useInvestorPortfolio(wallet.publicKey);
  const claimRefund = useClaimRefund();
  const claimReturn = useClaimReturn();

  const investments = portfolioQuery.data ?? [];
  const stats = calculatePortfolioStats(investments);

  const handleClaimRefund = async (campaignId: string) => {
    if (!wallet.publicKey) return;
    try {
      await claimRefund.mutateAsync({
        campaignId,
        investor: wallet.publicKey,
      });
    } catch {
      // useClaimRefund already toasts on error.
    }
  };

  const handleClaimReturn = async (campaignId: string) => {
    if (!wallet.publicKey) return;
    try {
      await claimReturn.mutateAsync({
        campaignId,
        investor: wallet.publicKey,
      });
    } catch {
      // useClaimReturn already toasts on error.
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Investor Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Track funded campaigns, claimable returns, and pro-rata refunds.
          </p>
        </div>

        {wallet.isConnected && wallet.publicKey ? (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-4 py-2 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300">
            <span
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"
              aria-hidden="true"
            />
            <span>Connected: {truncateAddress(wallet.publicKey)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-4 py-2 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300">
            <span
              className="w-2.5 h-2.5 rounded-full bg-slate-400"
              aria-hidden="true"
            />
            <span>Wallet not connected</span>
          </div>
        )}
      </div>

      {!configured && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Soroban RPC not configured
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Set <code className="font-mono">VITE_SOROBAN_RPC_URL</code> and{' '}
            <code className="font-mono">
              VITE_PRODUCTION_ESCROW_CONTRACT_ID
            </code>{' '}
            to load your on-chain investments.
          </p>
        </div>
      )}

      {configured && !wallet.isConnected && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Connect to view your investments
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Connect your Stellar wallet to see campaigns you have funded and to
            claim refunds or returns on-chain.
          </p>
          <button
            type="button"
            onClick={() => void wallet.connect()}
            disabled={wallet.isConnecting}
            className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
          >
            {wallet.isConnecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        </div>
      )}

      {configured && wallet.isConnected && portfolioQuery.isLoading && (
        <DashboardRowsSkeleton count={3} />
      )}

      {configured && wallet.isConnected && portfolioQuery.isError && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
          <p className="text-sm text-rose-700 dark:text-rose-400">
            Couldn&apos;t load your investments from the network. Try reloading
            the page.
          </p>
        </div>
      )}

      {configured && wallet.isConnected && portfolioQuery.isSuccess && (
        <>
          <InvestorSummaryStats
            stats={stats}
            totalCampaigns={investments.length}
          />

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Your Contributions ({investments.length})
            </h2>

            {investments.length === 0 ? (
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
}

export default InvestorDashboardPage;
