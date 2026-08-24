import React, { useState } from 'react';
import type { FundedInvestment } from '../../lib/soroban/investorService';
import { StatusBadge } from '../campaign/StatusBadge';

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
    <div className="flex flex-col justify-between gap-4 rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign transition hover:border-soil-300 dark:border-soil-800 dark:bg-soil-900 md:flex-row md:items-center">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <StatusBadge status={investment.status} />
          <span className="font-mono text-xs text-soil-600 dark:text-soil-400">
            ID: {investment.campaignId}
          </span>
        </div>

        <h3 className="text-lg font-bold text-soil-900 dark:text-soil-50">
          {investment.title}
        </h3>

        <div className="flex items-center gap-6 text-sm text-soil-600 dark:text-soil-400">
          <div>
            Contributed:{' '}
            <span className="font-semibold text-soil-900 dark:text-soil-50">
              ${investment.amountContributed.toLocaleString()}
            </span>
          </div>
          <div>
            Claimable:{' '}
            <span className="font-semibold text-leaf-700 dark:text-leaf-400">
              ${investment.claimableAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        {investment.claimed ? (
          <span className="rounded-xl border border-soil-200 bg-soil-100 px-4 py-2 text-xs font-semibold text-soil-600 dark:border-soil-700 dark:bg-soil-800 dark:text-soil-400">
            <span aria-hidden="true">✓</span> Claimed
          </span>
        ) : isRefundable ? (
          <button
            type="button"
            onClick={() => void handleClaim()}
            disabled={claiming}
            className="rounded-xl bg-status-harvested-dark px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-bark-800 disabled:opacity-50"
          >
            {claiming ? 'Claiming...' : 'Claim Refund'}
          </button>
        ) : isReturnable ? (
          <button
            type="button"
            onClick={() => void handleClaim()}
            disabled={claiming}
            className="rounded-xl bg-leaf-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-leaf-700 disabled:opacity-50"
          >
            {claiming ? 'Claiming...' : 'Claim Return'}
          </button>
        ) : (
          <span className="text-xs italic text-soil-600 dark:text-soil-400">
            No payout pending
          </span>
        )}
      </div>
    </div>
  );
};
