import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FundCampaignModal } from '../components/campaign/FundCampaignModal';
import { StatusBadge } from '../components/campaign/StatusBadge';
import { ActivityFeed } from '../components/campaign/ActivityFeed';
import { useCampaignLiveUpdates } from '../hooks/useCampaignLiveUpdates';
import { useCampaign } from '../hooks/contract/useEscrowQueries';
import { DetailPageSkeleton } from '../components/ui/Skeleton/Skeleton';

const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign';
const primaryButtonClass =
  'rounded-lg bg-leaf-700 px-6 py-3 font-semibold text-white shadow-campaign transition hover:bg-leaf-800 disabled:opacity-50';

export const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: campaign, isLoading, isError, refetch } = useCampaign(id);

  // Refreshes this page when another wallet's contribution changes funding progress.
  useCampaignLiveUpdates(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <DetailPageSkeleton />
      </div>
    );
  }

  if (isError || !campaign || !id) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className={`${cardClass} py-12 text-center`}>
          <h2 className="text-h4 text-soil-900">Campaign Not Found</h2>
          <p className="mx-auto mt-2 max-w-md text-body-sm text-soil-500">
            The requested campaign &quot;{id || ''}&quot; could not be loaded
            from the on-chain contract.
          </p>
        </div>
      </div>
    );
  }

  const totalTarget = Number(campaign.target_amount);
  const currentRaised = Number(campaign.total_funded);
  const title = campaign.harvest_metadata || `Campaign #${id}`;
  const status = campaign.status.tag;

  const percentage =
    totalTarget > 0
      ? Math.min(100, Math.round((currentRaised / totalTarget) * 100))
      : 0;

  const numericCampaignId = (() => {
    try {
      return BigInt(id);
    } catch {
      return 0n;
    }
  })();

  const handleFundingSuccess = () => {
    void refetch();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <StatusBadge status={status} />
          <span className="font-mono text-caption text-soil-500">
            ID: {id}
          </span>
        </div>

        <h1 className="mt-3 text-h2 text-soil-900">{title}</h1>
        <p className="mt-2 text-body text-soil-600">
          Farmer: {campaign.farmer}
        </p>

        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-body-sm">
            <span className="font-semibold text-soil-900">
              ${currentRaised.toLocaleString()}{' '}
              <span className="font-normal text-soil-500">raised</span>
            </span>
            <span className="font-medium text-soil-500">
              Target: ${totalTarget.toLocaleString()} ({percentage}%)
            </span>
          </div>

          <div
            className="h-3 w-full overflow-hidden rounded-full bg-soil-100"
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

        <div className="mt-6 flex justify-end border-t border-soil-100 pt-4">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            disabled={
              currentRaised >= totalTarget ||
              (status !== 'Funding' && status !== 'Active')
            }
            className={primaryButtonClass}
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

      <div className={cardClass}>
        <ActivityFeed
          campaignId={numericCampaignId}
          pageSize={10}
          refreshIntervalMs={30_000}
        />
      </div>
    </div>
  );
};

export default CampaignDetailPage;
