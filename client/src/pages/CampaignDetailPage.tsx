import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FundCampaignModal } from '../components/campaign/FundCampaignModal';
import { StatusBadge } from '../components/campaign/StatusBadge';
import { ActivityFeed } from '../components/campaign/ActivityFeed';
import { useCampaignLiveUpdates } from '../hooks/useCampaignLiveUpdates';
import { DetailPageSkeleton } from '../components/ui/Skeleton/Skeleton';
import { useCampaign } from '../hooks/contract/useEscrowQueries';

export const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading } = useCampaign(id);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useCampaignLiveUpdates(id);

  if (isLoading || !campaign) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <DetailPageSkeleton />
      </div>
    );
  }

  const totalTarget = Number(campaign.target_amount) / 1e7;
  const currentRaised = Number(campaign.total_funded) / 1e7;
  const status = campaign.status.tag;

  const percentage = Math.min(
    100,
    totalTarget > 0 ? Math.round((currentRaised / totalTarget) * 100) : 0,
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <StatusBadge status={status as any} />
          <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
            ID: {id}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
          Campaign {id}
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2">
          On-chain campaign details.
        </p>

        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">
              ${currentRaised.toLocaleString()}{' '}
              <span className="font-normal text-slate-600 dark:text-slate-400">
                raised
              </span>
            </span>
            <span className="font-medium text-slate-500">
              Target: ${totalTarget.toLocaleString()} ({percentage}%)
            </span>
          </div>

          <div
            className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Campaign funding progress: ${percentage}% of target raised`}
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            disabled={currentRaised >= totalTarget}
            className="rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-emerald-800 disabled:opacity-50"
          >
            Fund this campaign
          </button>
        </div>
      </div>

      <FundCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaignId={id!}
        campaignTitle={`Campaign ${id}`}
        totalTarget={totalTarget}
        currentRaised={currentRaised}
        onSuccess={() => {}}
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <ActivityFeed
          campaignId={BigInt(id?.replace(/\D/g, '') || '0')}
          pageSize={10}
          refreshIntervalMs={30_000}
        />
      </div>
    </div>
  );
};

export default CampaignDetailPage;
