import React, { useState } from 'react';
import { FundCampaignModal } from '../components/campaign/FundCampaignModal';
import { OpenDisputeModal } from '../components/campaign/OpenDisputeModal';
import {
  DisputeDetailsCard,
  type DisputeSummary,
} from '../components/campaign/DisputeDetailsCard';
import { StatusBadge } from '../components/campaign/StatusBadge';
import { ActivityFeed } from '../components/campaign/ActivityFeed';
import { useCampaignLiveUpdates } from '../hooks/useCampaignLiveUpdates';
import { DetailPageSkeleton } from '../components/ui/Skeleton/Skeleton';
import { useWallet } from '../context/WalletContext';
import { useContribution, useEscrowAdmin } from '../hooks/contract';
import { evaluateDisputeEligibility } from '../lib/dispute/eligibility';
import type { CampaignStatusTag } from '../lib/soroban/types';

export interface CampaignData {
  id: string;
  title: string;
  description: string;
  totalTarget: number;
  currentRaised: number;
  status: CampaignStatusTag;
  /** Campaign owner — one of the wallets authorized to open a dispute. */
  farmer: string;
}

export const CampaignDetailPage: React.FC = () => {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [dispute, setDispute] = useState<DisputeSummary | null>(null);

  const { publicKey } = useWallet();

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
        farmer: 'GDF4ZQK7XSLM2N6RJHVWPTYA3BCEUO5IQD8GLNXWMR9TKZVH2PJC4YSB',
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Refreshes this page when another wallet's contribution changes funding
  // progress; no-op (and no page breakage) if VITE_WS_URL isn't configured.
  // Called unconditionally (before the loading early-return) per rules of
  // hooks; the hook itself no-ops until a campaign id is available.
  useCampaignLiveUpdates(campaign?.id);

  // Eligibility inputs. Both hooks no-op until the escrow contract is
  // configured, in which case the wallet simply isn't shown the button.
  const { data: adminAddress } = useEscrowAdmin();
  const { data: contribution } = useContribution(
    campaign?.id,
    publicKey ?? undefined,
  );

  const eligibility = evaluateDisputeEligibility({
    status: campaign?.status,
    walletAddress: publicKey,
    farmer: campaign?.farmer,
    admin: adminAddress,
    contribution,
  });

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

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          {eligibility.eligible && (
            <button
              type="button"
              onClick={() => setIsDisputeModalOpen(true)}
              className="rounded-xl border border-red-300 px-6 py-3 font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
            >
              Open Dispute
            </button>
          )}
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

      {dispute && <DisputeDetailsCard dispute={dispute} />}

      <FundCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        totalTarget={campaign.totalTarget}
        currentRaised={campaign.currentRaised}
        onSuccess={handleFundingSuccess}
      />

      {eligibility.eligible && publicKey && (
        <OpenDisputeModal
          isOpen={isDisputeModalOpen}
          onClose={() => setIsDisputeModalOpen(false)}
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          opener={publicKey}
          role={eligibility.role!}
          onSuccess={handleDisputeSuccess}
        />
      )}

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
