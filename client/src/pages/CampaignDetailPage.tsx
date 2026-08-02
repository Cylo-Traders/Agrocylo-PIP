import React, { useState } from 'react';
import { FundCampaignModal } from '../components/campaign/FundCampaignModal';
import { StatusBadge } from '../components/campaign/StatusBadge';
import { OpenDisputeForm } from '../components/campaign/OpenDisputeForm';
import { ActivityFeed } from '../components/campaign/ActivityFeed';
import { useCampaignLiveUpdates } from '../hooks/useCampaignLiveUpdates';
import { DetailPageSkeleton } from '../components/ui/Skeleton/Skeleton';
import type { CampaignStatusTag } from '../lib/soroban/types';

export interface CampaignData {
  id: string;
  title: string;
  description: string;
  totalTarget: number;
  currentRaised: number;
  status: CampaignStatusTag;
  farmer: string;
}

export const CampaignDetailPage: React.FC = () => {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setCampaign({
        id: 'camp-101',
        title: 'Organic Maize Irrigation & Harvesting PIP',
        description:
          'Scaling sustainable maize production across 250 hectares with automated precision drip irrigation and AI-powered yield monitoring.',
        totalTarget: 50000,
        currentRaised: 32500,
        status: 'Funding' as CampaignStatusTag,
        farmer: 'GBMIR4JZQ6N3XK3Y5F6Y6Z7X8Y9Z0X1Y2Z3X4Y5Z6X7Y8Z9X0Y1Z2X3Y4Z',
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Refreshes this page when another wallet's contribution changes funding
  // progress; no-op (and no page breakage) if VITE_WS_URL isn't configured.
  // Called unconditionally (before the loading early-return) per rules of
  // hooks; the hook itself no-ops until a campaign id is available.
  useCampaignLiveUpdates(campaign?.id);

  if (!campaign) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <DetailPageSkeleton />
      </div>
    );
  }

  const percentage = Math.min(
    100,
    Math.round((campaign.currentRaised / campaign.totalTarget) * 100),
  );

  const handleFundingSuccess = (_res: unknown, addedAmount: number) => {
    setCampaign((prev) =>
      prev
        ? {
            ...prev,
            currentRaised: prev.currentRaised + addedAmount,
          }
        : prev,
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <StatusBadge status={campaign.status} />
          <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
            ID: {campaign.id}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
          {campaign.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2">
          {campaign.description}
        </p>

        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">
              ${campaign.currentRaised.toLocaleString()}{' '}
              <span className="font-normal text-slate-600 dark:text-slate-400">
                raised
              </span>
            </span>
            <span className="font-medium text-slate-500">
              Target: ${campaign.totalTarget.toLocaleString()} ({percentage}%)
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
            disabled={campaign.currentRaised >= campaign.totalTarget}
            className="rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-emerald-800 disabled:opacity-50"
          >
            Fund this campaign
          </button>
        </div>
      </div>

      <OpenDisputeForm
        campaignId={campaign.id}
        campaignStatus={campaign.status}
        farmerAddress={campaign.farmer}
      />

      <FundCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        totalTarget={campaign.totalTarget}
        currentRaised={campaign.currentRaised}
        onSuccess={handleFundingSuccess}
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <ActivityFeed
          campaignId={BigInt(campaign.id.replace(/\D/g, '') || '0')}
          pageSize={10}
          refreshIntervalMs={30_000}
        />
      </div>
    </div>
  );
};

export default CampaignDetailPage;
