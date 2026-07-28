import React, { useState } from 'react';
import type { FundedInvestment } from '../../lib/soroban/investorService';

export interface InvestmentCardProps {
  investment: FundedInvestment;
  onClaimRefund: (campaignId: string) => Promise<void>;
  onClaimReturn: (campaignId: string) => Promise<void>;
}

const statusBadgeStyles: Record<string, string> = {
  Active: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Funding:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Settled:
    'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  Resolved: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Failed: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
};

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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-300 dark:hover:border-slate-700">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 text-xs font-semibold rounded-full ${
              statusBadgeStyles[investment.status] ||
              'bg-slate-100 text-slate-800'
            }`}
          >
            {investment.status}
          </span>
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
            ID: {investment.campaignId}
          </span>
        </div>

        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {investment.title}
        </h3>

        <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
          <div>
            Contributed:{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              ${investment.amountContributed.toLocaleString()}
            </span>
          </div>
          <div>
            Claimable:{' '}
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              ${investment.claimableAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        {investment.claimed ? (
          <span className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
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
            className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
          >
            {claiming ? 'Claiming...' : 'Claim Return'}
          </button>
        ) : (
          <span className="text-xs italic text-slate-600 dark:text-slate-400">
            No payout pending
          </span>
        )}
      </div>
    </div>
  );
};
