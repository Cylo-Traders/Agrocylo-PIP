import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FundCampaignModal } from '../components/campaign/FundCampaignModal';
import { StatusBadge } from '../components/campaign/StatusBadge';
import { ActivityFeed } from '../components/campaign/ActivityFeed';
import { useCampaignLiveUpdates } from '../hooks/useCampaignLiveUpdates';
import { useCampaign } from '../hooks/contract/useEscrowQueries';
import { contractQueryKeys } from '../hooks/contract/queryKeys';
import { DetailPageSkeleton } from '../components/ui/Skeleton/Skeleton';
import type { CampaignStatusTag } from '../lib/soroban/types';

function toDisplayAmount(value: bigint): number {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : 0;
}

export const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: campaign, isLoading, isError, error } = useCampaign(id);

  useCampaignLiveUpdates(id);

  if (!id) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-soil-600">No campaign id in the URL.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <DetailPageSkeleton />
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="mx-auto max-w-4xl p-6" role="alert">
        <p className="text-status-failed-dark">
          {error instanceof Error
            ? error.message
            : `Could not load campaign ${id}.`}
        </p>
      </div>
    );
  }

  const status = campaign.status.tag as CampaignStatusTag;
  const totalTarget = toDisplayAmount(campaign.target_amount);
  const currentRaised = toDisplayAmount(campaign.total_funded);
  const percentage =
    totalTarget > 0
      ? Math.min(100, Math.round((currentRaised / totalTarget) * 100))
      : 0;
  const title = campaign.harvest_metadata || `Campaign ${id}`;

  const handleFundingSuccess = () => {
    void queryClient.invalidateQueries({
      queryKey: contractQueryKeys.campaign(id),
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign dark:border-soil-800 dark:bg-soil-900">
        <div className="flex items-center justify-between">
          <StatusBadge status={status} />
          <span className="font-mono text-sm text-soil-600 dark:text-soil-400">
            ID: {id}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-bold text-soil-900 dark:text-soil-50">
          {title}
        </h1>
        <p className="mt-2 text-soil-600 dark:text-soil-300">
          Farmer {campaign.farmer}
        </p>

        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-soil-900 dark:text-soil-50">
              ${currentRaised.toLocaleString()}{' '}
              <span className="font-normal text-soil-600 dark:text-soil-400">
                raised
              </span>
            </span>
            <span className="font-medium text-soil-500">
              Target: ${totalTarget.toLocaleString()} ({percentage}%)
            </span>
          </div>

          <div
            className="h-3 w-full overflow-hidden rounded-full bg-soil-100 dark:bg-soil-800"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Campaign funding progress: ${percentage}% of target raised`}
          >
            <div
              className="h-full rounded-full bg-leaf-600 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-soil-100 pt-4 dark:border-soil-800">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            disabled={currentRaised >= totalTarget}
            className="rounded-xl bg-leaf-600 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-leaf-700 disabled:opacity-50"
          >
            Fund this campaign
          </button>
        </div>
      </div>

      <FundCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaignId={id}
        campaignTitle={title}
        totalTarget={totalTarget}
        currentRaised={currentRaised}
        onSuccess={handleFundingSuccess}
      />

      <div className="rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign dark:border-soil-800 dark:bg-soil-900">
        <ActivityFeed
          campaignId={BigInt(id.replace(/\D/g, '') || '0')}
          pageSize={10}
          refreshIntervalMs={30_000}
        />
      </div>
    </div>
  );
};

export default CampaignDetailPage;
