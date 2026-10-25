import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { useWallet } from '../context/WalletContext';
import { useEscrowAdmin } from '../hooks/contract';
import {
  useAdminCampaigns,
  LOOKBACK_LEDGERS,
  type AdminCampaignOverview,
} from '../hooks/useAdminCampaigns';
import { isEscrowConfigured } from '../lib/soroban/config';
import { CampaignAdminPanel } from '../components/admin/CampaignAdminPanel';
import {
  DashboardRowSkeleton,
  DashboardRowsSkeleton,
} from '../components/ui/Skeleton/Skeleton';

const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign sm:p-8';
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-leaf-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function NotConfiguredNotice() {
  return (
    <div className={cardClass}>
      <h1 className="text-h3 text-soil-950">Soroban RPC not configured</h1>
      <p className="mt-2 text-body-sm text-soil-500">
        Set <code className="font-mono">VITE_SOROBAN_RPC_URL</code> and{' '}
        <code className="font-mono">VITE_PRODUCTION_ESCROW_CONTRACT_ID</code> to
        manage campaigns from the admin dashboard.
      </p>
    </div>
  );
}

function AdminOverview({ campaigns }: { campaigns: AdminCampaignOverview[] }) {
  const countsByStatus = campaigns.reduce(
    (acc, { campaign }) => {
      const tag = campaign.status.tag;
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const openDisputes = countsByStatus['Disputed'] || 0;
  const pendingTranches = countsByStatus['Funded'] || 0;
  const activeFunding =
    (countsByStatus['Active'] || 0) + (countsByStatus['Funding'] || 0);

  return (
    <div className={cardClass}>
      <h2 className="text-h4 text-soil-900 mb-4">Admin Overview</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-caption text-soil-500">Actionable Campaigns</p>
          <p className="text-h3 text-soil-900">{campaigns.length}</p>
        </div>
        <div>
          <p className="text-caption text-soil-500">Open Disputes</p>
          <p className="text-h3 text-soil-900">{openDisputes}</p>
        </div>
        <div>
          <p className="text-caption text-soil-500">Pending Tranches</p>
          <p className="text-h3 text-soil-900">{pendingTranches}</p>
        </div>
        <div>
          <p className="text-caption text-soil-500">Active / Funding</p>
          <p className="text-h3 text-soil-900">{activeFunding}</p>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const wallet = useWallet();
  const adminQuery = useEscrowAdmin();
  const [lookbackMultiplier, setLookbackMultiplier] = useState(1);
  const effectiveLookback = (LOOKBACK_LEDGERS ?? 120_000) * lookbackMultiplier;
  const campaignsQuery = useAdminCampaigns({
    lookbackLedgers: effectiveLookback,
  });

  const configured = isEscrowConfigured();
  const isAdmin =
    configured &&
    Boolean(wallet.publicKey) &&
    Boolean(adminQuery.data) &&
    wallet.publicKey === adminQuery.data;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <Header />

      <div className="mb-8 mt-6">
        <Link
          to="/"
          className="text-body-sm font-semibold text-leaf-700 hover:text-leaf-800"
        >
          ← Back
        </Link>
        <p className="mt-4 text-label text-leaf-700">Escrow administration</p>
        <h1 className="mt-1 text-soil-950">Admin dashboard</h1>
        <p className="mt-2 text-body-sm text-soil-500">
          Configure tranches, release funds, resolve disputes, settle campaigns,
          and mark campaigns failed. Only the escrow admin wallet can submit
          these actions — the contract enforces this independently, so nothing
          here bypasses on-chain authorization.
        </p>
      </div>

      {!configured && <NotConfiguredNotice />}

      {configured && !wallet.isConnected && (
        <div className={cardClass}>
          <p className="text-body-sm text-soil-600">
            Connect the escrow admin wallet to manage campaigns.
          </p>
          <button
            type="button"
            onClick={() => void wallet.connect()}
            disabled={wallet.isConnecting}
            className={`${primaryButtonClass} mt-4`}
          >
            {wallet.isConnecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        </div>
      )}

      {configured && wallet.isConnected && adminQuery.isLoading && (
        <div className={cardClass} aria-busy="true">
          <DashboardRowSkeleton />
        </div>
      )}

      {configured && wallet.isConnected && adminQuery.isError && (
        <div className={cardClass}>
          <p className="text-body-sm text-status-failed-dark">
            Couldn&apos;t verify the escrow admin address. Try reloading the
            page.
          </p>
        </div>
      )}

      {configured && wallet.isConnected && adminQuery.isSuccess && !isAdmin && (
        <div className={cardClass}>
          <h2 className="text-h4 text-soil-900">Not authorized</h2>
          <p className="mt-2 text-body-sm text-soil-500">
            The connected wallet is not the escrow admin. Admin actions are only
            available to the wallet that initialized this
            ProductionEscrowContract instance.
          </p>
        </div>
      )}

      {isAdmin && (
        <div className="space-y-6">
          <div
            role="region"
            aria-label="Campaign discovery lookback notice"
            className="rounded-campaign border border-leaf-200 bg-leaf-50/60 p-4 sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full bg-leaf-600"
                    aria-hidden="true"
                  />
                  <h2 className="text-body-sm font-semibold text-soil-900">
                    Campaign Discovery: Lookback Window Active (
                    {effectiveLookback.toLocaleString()} ledgers)
                  </h2>
                </div>
                <p className="mt-1 text-caption text-soil-600">
                  Showing actionable campaigns discovered from events in the
                  trailing ~{effectiveLookback.toLocaleString()} ledgers (~
                  {Math.round((effectiveLookback * 5) / 86400)} days). Campaigns
                  created prior to this window may not appear without backend
                  indexing or expanded lookback.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setLookbackMultiplier((prev) => prev + 1)}
                  disabled={campaignsQuery.isFetching}
                  className="rounded-md border border-leaf-300 bg-white px-3 py-1.5 text-xs font-semibold text-leaf-800 hover:bg-leaf-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 disabled:opacity-50"
                >
                  {campaignsQuery.isFetching
                    ? 'Scanning...'
                    : `Load older history (+${(LOOKBACK_LEDGERS ?? 120_000).toLocaleString()} ledgers)`}
                </button>
              </div>
            </div>
          </div>

          {campaignsQuery.isLoading && (
            <div aria-busy="true">
              <DashboardRowsSkeleton count={3} />
            </div>
          )}

          {campaignsQuery.isError && (
            <div className={cardClass}>
              <p className="text-body-sm text-status-failed-dark">
                Couldn&apos;t load campaigns from Soroban RPC.
              </p>
            </div>
          )}

          {campaignsQuery.isSuccess && campaignsQuery.data.length > 0 && (
            <AdminOverview campaigns={campaignsQuery.data} />
          )}

          {campaignsQuery.isSuccess && campaignsQuery.data.length === 0 && (
            <div className={cardClass}>
              <p className="text-body-sm text-soil-500">
                No campaigns currently need admin attention.
              </p>
            </div>
          )}

          {campaignsQuery.isSuccess &&
            campaignsQuery.data.map((overview) => (
              <CampaignAdminPanel key={overview.id} overview={overview} />
            ))}
        </div>
      )}
    </section>
  );
}

export default AdminDashboardPage;
