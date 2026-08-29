import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/campaign/StatusBadge';
import { CampaignCardsSkeleton } from '../components/ui/Skeleton/Skeleton';
import { isEscrowConfigured } from '../lib/soroban/config';
import { STATUS_META } from '../lib/campaignStatus';
import type { CampaignStatusTag } from '../lib/soroban/types';
import {
  useAllCampaigns,
  type CampaignOverview,
} from '../hooks/useAllCampaigns';

const sectionClass = 'mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8';
const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-8 shadow-campaign sm:p-12';
const primaryLinkClass =
  'inline-flex rounded-lg bg-leaf-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2';

function CampaignCard({ id, campaign }: CampaignOverview) {
  const target = Number(campaign.target_amount);
  const raised = Number(campaign.total_funded);
  const pct =
    target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
  const title = campaign.harvest_metadata || `Campaign #${id}`;

  return (
    <Link
      to={`/campaigns/${id}`}
      className="group flex w-full flex-col rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign transition hover:border-soil-300 hover:shadow-campaign-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500"
    >
      <div className="flex items-center justify-between">
        <StatusBadge status={campaign.status.tag} />
        <span className="font-mono text-caption text-soil-500">#{id}</span>
      </div>

      <h2 className="mt-3 text-h4 text-soil-950 group-hover:text-leaf-800">
        {title}
      </h2>
      <p className="mt-1 truncate font-mono text-caption text-soil-500">
        Farmer: {campaign.farmer}
      </p>

      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between text-body-sm">
          <span className="font-semibold text-soil-900">
            ${raised.toLocaleString()}{' '}
            <span className="font-normal text-soil-500">raised</span>
          </span>
          <span className="font-medium text-soil-500">
            ${target.toLocaleString()} ({pct}%)
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-soil-100"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${title} funding progress: ${pct}% of target raised`}
        >
          <div
            className="h-full rounded-full bg-leaf-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

export function CampaignsPage() {
  const { data, isLoading, isError, refetch } = useAllCampaigns();
  const [filter, setFilter] = useState<CampaignStatusTag | 'All'>('All');

  const campaigns = useMemo(() => data ?? [], [data]);
  const availableStatuses = useMemo(
    () =>
      Array.from(
        new Set(campaigns.map((c) => c.campaign.status.tag)),
      ).sort() as CampaignStatusTag[],
    [campaigns],
  );
  const visible =
    filter === 'All'
      ? campaigns
      : campaigns.filter((c) => c.campaign.status.tag === filter);

  return (
    <section className={sectionClass}>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-label text-leaf-700">Marketplace</p>
          <h1 className="mt-1 text-soil-950">Campaigns</h1>
          <p className="mt-2 max-w-2xl text-body text-soil-600">
            Browse live on-chain agricultural funding campaigns and back the
            ones you believe in.
          </p>
        </div>
        <Link to="/campaigns/new" className={primaryLinkClass}>
          Create a campaign
        </Link>
      </div>

      {!isEscrowConfigured() ? (
        <div className={cardClass}>
          <h2 className="text-h3 text-soil-950">Soroban RPC not configured</h2>
          <p className="mt-2 text-body-sm text-soil-500">
            Set <code className="font-mono">VITE_SOROBAN_RPC_URL</code> and{' '}
            <code className="font-mono">
              VITE_PRODUCTION_ESCROW_CONTRACT_ID
            </code>{' '}
            to load campaigns from the network.
          </p>
        </div>
      ) : isLoading ? (
        <CampaignCardsSkeleton count={6} />
      ) : isError ? (
        <div className={cardClass}>
          <h2 className="text-h4 text-soil-900">
            Couldn&apos;t load campaigns
          </h2>
          <p className="mt-2 text-body-sm text-status-failed-dark">
            The Soroban RPC request failed. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className={`${primaryLinkClass} mt-4`}
          >
            Retry
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className={cardClass}>
          <h2 className="text-h4 text-soil-900">No campaigns yet</h2>
          <p className="mt-2 text-body-sm text-soil-500">
            No campaigns have been created on this contract yet. Be the first to
            launch one.
          </p>
          <Link to="/campaigns/new" className={`${primaryLinkClass} mt-4`}>
            Create a campaign
          </Link>
        </div>
      ) : (
        <>
          {availableStatuses.length > 1 && (
            <div
              className="mb-6 flex flex-wrap gap-2"
              role="group"
              aria-label="Filter campaigns by status"
            >
              {(['All', ...availableStatuses] as const).map((status) => {
                const active = filter === status;
                const label =
                  status === 'All' ? 'All' : STATUS_META[status].label;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(status)}
                    className={[
                      'rounded-full border px-3 py-1 text-body-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500',
                      active
                        ? 'border-leaf-700 bg-leaf-700 text-white'
                        : 'border-soil-200 bg-white text-soil-600 hover:bg-soil-100',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {visible.length === 0 ? (
            <div className={cardClass}>
              <p className="text-body-sm text-soil-500">
                No campaigns match the selected filter.
              </p>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((overview) => (
                <li key={overview.id} className="flex">
                  <CampaignCard {...overview} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export default CampaignsPage;
