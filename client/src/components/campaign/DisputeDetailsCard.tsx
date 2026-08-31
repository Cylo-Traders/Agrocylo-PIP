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
    className="rounded-campaign border border-status-disputed/30 bg-status-disputed-light p-6 shadow-campaign"
  >
    <div className="flex items-center justify-between">
      <h2
        id="dispute-details-heading"
        className="text-lg font-semibold text-status-disputed-dark"
      >
        Dispute {dispute.status === 'Open' ? 'open' : 'resolved'}
      </h2>
      <span className="rounded-full border border-status-disputed/30 bg-status-disputed-light px-3 py-1 text-xs font-semibold text-status-disputed-dark">
        {dispute.status}
      </span>
    </div>

    <dl className="mt-4 space-y-3 text-sm">
      <div>
        <dt className="font-medium text-status-disputed-dark">Reason</dt>
        <dd className="mt-1 whitespace-pre-wrap text-status-disputed-dark">
          {dispute.reason}
        </dd>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="font-medium text-status-disputed-dark">Opened by</dt>
          <dd className="mt-1 font-mono text-status-disputed-dark">
            {truncateAddress(dispute.opener)}
          </dd>
        </div>
        {dispute.timestamp !== undefined && (
          <div>
            <dt className="font-medium text-status-disputed-dark">Opened at</dt>
            <dd className="mt-1 text-status-disputed-dark">
              {new Date(dispute.timestamp * 1000).toLocaleString()}
            </dd>
          </div>
        )}
      </div>
    </dl>

    <p className="mt-4 border-t border-status-disputed/20 pt-3 text-xs text-status-disputed-dark">
      Fund release is paused until an admin resolves this dispute.
    </p>
  </section>
);

export default DisputeDetailsCard;
