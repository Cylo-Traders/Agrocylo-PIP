import React, { useState } from 'react';
import type { FundedInvestment } from '../../lib/soroban/investorService';
import { StatusBadge } from '../campaign/StatusBadge';
import type { CampaignStatusTag } from '../../lib/soroban/types';

export interface InvestmentCardProps {
  investment: FundedInvestment;
  onClaimRefund: (campaignId: string) => Promise<void>;
  onClaimReturn: (campaignId: string) => Promise<void>;
}

export const InvestmentCard: React.FC<InvestmentCardProps> = ({
  investment,
  onClaimRefund,
  onClaimReturn,
}) => {
  const [claiming, setClaiming] = useState(false);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      if (investment.status === 'Settled') {
        await onClaimReturn(investment.campaignId);
      } else if (
        investment.status === 'Resolved' ||
        investment.status === 'Failed'
      ) {
        await onClaimRefund(investment.campaignId);
      }
    } finally {
      setClaiming(false);
    }
  };

  const isRefundable =
    (investment.status === 'Resolved' || investment.status === 'Failed') &&
    investment.claimableAmount > 0 &&
    !investment.claimed;

  const isReturnable =
    investment.status === 'Settled' &&
    investment.claimableAmount > 0 &&
    !investment.claimed;

  return (
    <div className="rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-soil-300">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <StatusBadge status={investment.status as CampaignStatusTag} />
          <span className="text-xs font-mono text-soil-500">
            ID: {investment.campaignId}
          </span>
        </div>

        <h3 className="text-lg font-bold text-soil-900">{investment.title}</h3>

        <div className="flex items-center gap-6 text-sm text-soil-500">
          <div>
            Contributed:{' '}
            <span className="font-semibold text-soil-900">
              ${investment.amountContributed.toLocaleString()}
            </span>
          </div>
          <div>
            Claimable:{' '}
            <span className="font-semibold text-leaf-700">
              ${investment.claimableAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        {investment.claimed ? (
          <span className="rounded-xl border border-soil-200 bg-soil-100 px-4 py-2 text-xs font-semibold text-soil-600">
            <span aria-hidden="true">✓</span> Claimed
          </span>
        ) : isRefundable ? (
          <button
            type="button"
            onClick={() => void handleClaim()}
            disabled={claiming}
            className="rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-50"
          >
            {claiming ? 'Claiming...' : 'Claim Refund'}
          </button>
        ) : isReturnable ? (
          <button
            type="button"
            onClick={() => void handleClaim()}
            disabled={claiming}
            className="rounded-xl bg-leaf-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-leaf-800 disabled:opacity-50"
          >
            {claiming ? 'Claiming...' : 'Claim Return'}
          </button>
        ) : (
          <span className="text-xs italic text-soil-500">
            No payout pending
          </span>
        )}
      </div>
    </div>
  );
};
