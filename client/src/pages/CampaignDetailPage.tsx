import React, { useState } from 'react';
import { FundCampaignModal } from '../components/campaign/FundCampaignModal';
import { StatusBadge } from '../components/campaign/StatusBadge';
import { DetailPageSkeleton } from '../components/ui/Skeleton/Skeleton';

export interface CampaignData {
  id: string;
  title: string;
  description: string;
  totalTarget: number;
  currentRaised: number;
  status: 'Active' | 'Funding' | 'Resolved' | 'Failed' | 'Settled';
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
        status: 'Funding',
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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

      <FundCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        totalTarget={campaign.totalTarget}
        currentRaised={campaign.currentRaised}
        onSuccess={handleFundingSuccess}
      />
    </div>
  );
};

export default CampaignDetailPage;
