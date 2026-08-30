import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FundCampaignModal } from '../components/campaign/FundCampaignModal';
import { OpenDisputeModal } from '../components/campaign/OpenDisputeModal';
import {
  DisputeDetailsCard,
  type DisputeSummary,
} from '../components/campaign/DisputeDetailsCard';
import { StatusBadge } from '../components/campaign/StatusBadge';
import { ActivityFeed } from '../components/campaign/ActivityFeed';
import { OpenDisputeForm } from '../components/campaign/OpenDisputeForm';
import { useCampaignLiveUpdates } from '../hooks/useCampaignLiveUpdates';
import { useCampaign } from '../hooks/contract/useEscrowQueries';
import { DetailPageSkeleton } from '../components/ui/Skeleton/Skeleton';
import { useWallet } from '../context/WalletContext';
import { useContribution, useEscrowAdmin } from '../hooks/contract';
import { evaluateDisputeEligibility } from '../lib/dispute/eligibility';
import type { CampaignStatusTag } from '../lib/soroban/types';

export const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [dispute, setDispute] = useState<DisputeSummary | null>(null);

  const { publicKey } = useWallet();

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
        <div className="rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign text-center py-12 space-y-3">
          <h2 className="text-xl font-bold text-soil-900">
            Campaign Not Found
          </h2>
          <p className="text-sm text-soil-500 max-w-md mx-auto">
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

  // Reflect the new state immediately rather than waiting for the indexer:
  // the contract has already accepted the dispute at this point.
  const handleDisputeSuccess = (reason: string) => {
    setCampaign((prev) => (prev ? { ...prev, status: 'Disputed' } : prev));
    setDispute({
      opener: publicKey!,
      reason,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'Open',
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign">
        <div className="flex items-center justify-between">
          <StatusBadge status={status} />
          <span className="text-sm font-mono text-soil-500">ID: {id}</span>
        </div>

        <h1 className="text-2xl font-bold text-soil-900 mt-3">{title}</h1>
        <p className="text-soil-600 mt-2">Farmer: {campaign.farmer}</p>

        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-sm">
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
            className="rounded-xl bg-leaf-700 px-6 py-3 font-semibold text-white shadow-md transition hover:bg-leaf-800 disabled:opacity-50"
          >
            Fund this campaign
          </button>
        </div>
      </div>

      {dispute && <DisputeDetailsCard dispute={dispute} />}

      <FundCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaignId={id}
        campaignTitle={title}
        totalTarget={totalTarget}
        currentRaised={currentRaised}
        onSuccess={handleFundingSuccess}
      />

      <div className="rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign">
        <ActivityFeed
          campaignId={numericCampaignId}
          pageSize={10}
          refreshIntervalMs={30_000}
        />
      </div>

      <OpenDisputeForm
        campaignId={campaign.id}
        farmerAddress={campaign.farmer}
      />
    </div>
  );
};

export default CampaignDetailPage;
