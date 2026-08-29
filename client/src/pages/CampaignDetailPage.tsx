import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FundCampaignModal } from '../components/campaign/FundCampaignModal';
import { StatusBadge } from '../components/campaign/StatusBadge';
import { ActivityFeed } from '../components/campaign/ActivityFeed';
import { useCampaignLiveUpdates } from '../hooks/useCampaignLiveUpdates';
import { useCampaign } from '../hooks/contract/useEscrowQueries';
import { DetailPageSkeleton } from '../components/ui/Skeleton/Skeleton';
import { Button } from '../components/ui/Button/Button';

export const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: campaign, isLoading, isError, refetch } = useCampaign(id);

  // Refreshes this page when another wallet's contribution changes funding progress.
  useCampaignLiveUpdates(id);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <DetailPageSkeleton />
      </div>
    );
  }

  if (isError || !campaign || !id) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign text-center py-12 space-y-3 dark:border-soil-800 dark:bg-soil-900">
          <h2 className="text-xl font-bold text-soil-900 dark:text-soil-50">
            Campaign Not Found
          </h2>
          <p className="text-sm text-soil-600 dark:text-soil-400 max-w-md mx-auto">
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign dark:border-soil-800 dark:bg-soil-900">
        <div className="flex items-center justify-between">
          <StatusBadge status={status} />
          <span className="text-sm font-mono text-soil-600 dark:text-soil-400">
            ID: {id}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-soil-900 dark:text-soil-50 mt-3">
          {title}
        </h1>
        <p className="text-soil-600 dark:text-soil-300 mt-2">
          Farmer: {campaign.farmer}
        </p>

        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-soil-900 dark:text-soil-50">
              ${currentRaised.toLocaleString()}{' '}
              <span className="font-normal text-soil-600 dark:text-soil-400">
                raised
              </span>
            </span>
            <span className="font-medium text-soil-600 dark:text-soil-400">
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

        <div className="mt-6 flex justify-end border-t border-soil-200 pt-4 dark:border-soil-800">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => setIsModalOpen(true)}
            disabled={
              currentRaised >= totalTarget ||
              (status !== 'Funding' && status !== 'Active')
            }
          >
            Fund this campaign
          </Button>
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
          campaignId={numericCampaignId}
          pageSize={10}
          refreshIntervalMs={30_000}
        />
      </div>
    </div>
  );
};

export default CampaignDetailPage;
