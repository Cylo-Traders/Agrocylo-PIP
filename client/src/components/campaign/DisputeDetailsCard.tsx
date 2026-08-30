import React from 'react';
import { truncateAddress } from '../../context/WalletContext';

export interface DisputeSummary {
  opener: string;
  reason: string;
  /** Unix seconds; omitted for an optimistic record awaiting indexing. */
  timestamp?: number;
  status: 'Open' | 'Resolved';
}

export interface DisputeDetailsCardProps {
  dispute: DisputeSummary;
}

/**
 * Surfaces the active dispute on a campaign — shown as soon as `open_dispute`
 * succeeds, before the indexer has caught up.
 */
export const DisputeDetailsCard: React.FC<DisputeDetailsCardProps> = ({
  dispute,
}) => (
  <section
    aria-labelledby="dispute-details-heading"
    className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/40"
  >
    <div className="flex items-center justify-between">
      <h2
        id="dispute-details-heading"
        className="text-lg font-semibold text-red-900 dark:text-red-200"
      >
        Dispute {dispute.status === 'Open' ? 'open' : 'resolved'}
      </h2>
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
        {dispute.status}
      </span>
    </div>

    <dl className="mt-4 space-y-3 text-sm">
      <div>
        <dt className="font-medium text-red-900 dark:text-red-200">Reason</dt>
        <dd className="mt-1 whitespace-pre-wrap text-red-800 dark:text-red-300">
          {dispute.reason}
        </dd>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="font-medium text-red-900 dark:text-red-200">
            Opened by
          </dt>
          <dd className="mt-1 font-mono text-red-800 dark:text-red-300">
            {truncateAddress(dispute.opener)}
          </dd>
        </div>
        {dispute.timestamp !== undefined && (
          <div>
            <dt className="font-medium text-red-900 dark:text-red-200">
              Opened at
            </dt>
            <dd className="mt-1 text-red-800 dark:text-red-300">
              {new Date(dispute.timestamp * 1000).toLocaleString()}
            </dd>
          </div>
        )}
      </div>
    </dl>

    <p className="mt-4 border-t border-red-200 pt-3 text-xs text-red-700 dark:border-red-900 dark:text-red-400">
      Fund release is paused until an admin resolves this dispute.
    </p>
  </section>
);

export default DisputeDetailsCard;
