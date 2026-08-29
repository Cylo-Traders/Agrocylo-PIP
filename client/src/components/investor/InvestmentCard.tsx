import React, { useState } from 'react';
import type { FundedInvestment } from '../../lib/soroban/investorService';
import { STATUS_META } from '../../lib/campaignStatus';
import type { CampaignStatusTag } from '../../lib/soroban/types';

export interface InvestmentCardProps {
  investment: FundedInvestment;
  onClaimRefund: (campaignId: string) => Promise<void>;
  onClaimReturn: (campaignId: string) => Promise<void>;
}

const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign flex flex-col gap-4 transition hover:border-soil-300 md:flex-row md:items-center md:justify-between';
const primaryValueClass = 'font-semibold text-soil-900';

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

  const statusMeta = STATUS_META[investment.status as CampaignStatusTag] ?? {
    label: investment.status,
    bgLight: 'bg-soil-100',
    text: 'text-soil-800',
  };

  return (
    <div className={cardClass}>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span
            className={`status-badge ${statusMeta.bgLight} ${statusMeta.text}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusMeta.bg}`} aria-hidden="true" />
            {statusMeta.label}
          </span>
          <span className="font-mono text-caption text-soil-500">
            ID: {investment.campaignId}
          </span>
        </div>

        <h3 className="text-lg font-bold text-soil-900">
          {investment.title}
        </h3>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-body-sm text-soil-600">
          <div>
            Contributed:{' '}
            <span className={primaryValueClass}>
              ${investment.amountContributed.toLocaleString()}
            </span>
          </div>
          <div>
            Claimable:{' '}
            <span className="font-semibold text-status-resolved">
              ${investment.claimableAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        {investment.claimed ? (
          <span className="rounded-lg border border-soil-200 bg-soil-50 px-4 py-2 text-caption font-semibold text-soil-600">
            <span aria-hidden="true">✓</span> Claimed
          </span>
        ) : isRefundable ? (
          <button
            type="button"
            onClick={() => void handleClaim()}
            disabled={claiming}
            className="rounded-lg bg-status-harvested px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {claiming ? 'Claiming...' : 'Claim Refund'}
          </button>
        ) : isReturnable ? (
          <button
            type="button"
            onClick={() => void handleClaim()}
            disabled={claiming}
            className="rounded-lg bg-status-resolved px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {claiming ? 'Claiming...' : 'Claim Return'}
          </button>
        ) : (
          <span className="text-caption italic text-soil-500">
            No payout pending
          </span>
        )}
      </div>
    </div>
  );
};
