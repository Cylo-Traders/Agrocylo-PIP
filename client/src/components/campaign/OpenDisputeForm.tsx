import { useState } from 'react';
import type { FormEvent } from 'react';
import { useWallet } from '../../context/WalletContext';
import { useOpenDispute } from '../../hooks/contract';
import { toUserFacingError } from '../../lib/soroban/userFacingError';
import type { CampaignStatusTag } from '../../lib/soroban/types';

const DISPUTABLE_STATUSES: CampaignStatusTag[] = [
  'Active',
  'Funding',
  'Funded',
];

const dangerButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-status-failed-dark px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-status-failed focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-soil-300 px-4 py-2 text-sm font-semibold text-soil-700 transition-colors hover:bg-soil-50 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-leaf-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputClass =
  'w-full rounded-lg border border-soil-300 px-3 py-2 text-body-sm text-soil-900 focus:border-leaf-500 focus:outline-none focus:ring-1 focus:ring-leaf-500';
const labelClass = 'mb-1 block text-label text-soil-500';
const errorClass = 'mt-1 text-caption text-status-failed-dark';
const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign';

export function OpenDisputeForm({
  campaignId,
  campaignStatus,
  farmerAddress,
}: {
  campaignId: string;
  campaignStatus: CampaignStatusTag;
  farmerAddress: string;
}) {
  const wallet = useWallet();
  const openDispute = useOpenDispute();
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canDispute = DISPUTABLE_STATUSES.includes(campaignStatus);
  const isEligible =
    wallet.isConnected &&
    wallet.publicKey !== null;

  // Check if the connected wallet is the campaign farmer
  const isFarmer: boolean =
    wallet.publicKey !== null &&
    wallet.publicKey === farmerAddress;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setFormError('Please provide a reason for opening the dispute.');
      return;
    }
    if (trimmedReason.length < 10) {
      setFormError('Please provide a more detailed reason (at least 10 characters).');
      return;
    }

    try {
      await openDispute.mutateAsync({
        campaignId,
        opener: wallet.publicKey!,
        reason: trimmedReason,
      });
      setSuccess(true);
      setReason('');
      setShowForm(false);
    } catch (err) {
      setFormError(toUserFacingError(err));
    }
  }

  if (!canDispute || !isEligible) {
    return null;
  }

  // Show the dispute record if already disputed
  if (campaignStatus === 'Disputed') {
    return (
      <div className={cardClass}>
        <h3 className="text-h4 text-soil-900">Dispute</h3>
        <p className="mt-1 text-body-sm text-soil-500">
          A dispute has been opened for this campaign. The campaign is on hold
          pending resolution.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className={cardClass}>
        <h3 className="text-h4 text-soil-900">Dispute opened</h3>
        <p className="mt-1 text-body-sm text-status-active-dark">
          Your dispute has been submitted. The campaign status will update to
          "Disputed" once the transaction is confirmed.
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <h3 className="text-h4 text-soil-900">Report an issue</h3>
      <p className="mt-1 text-body-sm text-soil-500">
        If something is wrong with this campaign, you can open a dispute. An
        admin will review the case and decide on the outcome.
        {isFarmer && (
          <span className="mt-1 block text-caption text-leaf-700">
            You are the farmer for this campaign.
          </span>
        )}
      </p>

      {showForm ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className={labelClass} htmlFor="dispute-reason">
              Reason for dispute
            </label>
            <textarea
              id="dispute-reason"
              className={`${inputClass} min-h-[100px] resize-y`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe what went wrong with this campaign…"
              rows={4}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={openDispute.isPending}
              className={primaryButtonClass}
            >
              {openDispute.isPending
                ? 'Confirm in wallet…'
                : 'Submit dispute'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
              disabled={openDispute.isPending}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
          {formError && <p className={errorClass}>{formError}</p>}
        </form>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className={dangerButtonClass}
          >
            Open dispute
          </button>
        </div>
      )}
    </div>
  );
}