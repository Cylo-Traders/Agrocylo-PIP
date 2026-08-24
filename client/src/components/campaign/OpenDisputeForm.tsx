import { useState } from 'react';
import type { FormEvent } from 'react';
import { useWallet } from '../../context/WalletContext';
import {
  useContribution,
  useEscrowAdmin,
  useOpenDispute,
} from '../../hooks/contract';
import { toUserFacingError } from '../../lib/soroban/userFacingError';

const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign';
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-leaf-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputClass =
  'w-full rounded-lg border border-soil-300 px-3 py-2 text-body-sm text-soil-900 focus:border-leaf-500 focus:outline-none focus:ring-1 focus:ring-leaf-500';
const labelClass = 'mb-1 block text-label text-soil-600';
const errorClass = 'mt-1 text-caption text-status-failed-dark';
const sectionTitleClass = 'text-h4 text-soil-900';

const REASON_ERROR_ID = 'dispute-reason-error';
const FORM_ERROR_ID = 'open-dispute-error';
const HEADING_ID = 'open-dispute-heading';

function ActionError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={errorClass}>
      {message}
    </p>
  );
}

export interface OpenDisputeFormProps {
  campaignId: string;
  farmerAddress: string;
}

/**
 * Lets a campaign's farmer, a contributing investor, or the escrow admin
 * open a dispute. Eligibility is a UX convenience only — `open_dispute`
 * enforces the same set on-chain via `.require_auth()`.
 *
 * Duplicate-dispute gating (already-open dispute) is intentionally not
 * handled here; that belongs to a separate follow-up.
 */
export function OpenDisputeForm({
  campaignId,
  farmerAddress,
}: OpenDisputeFormProps) {
  const { publicKey } = useWallet();
  const openDispute = useOpenDispute();
  const { data: contribution } = useContribution(
    campaignId,
    publicKey ?? undefined,
  );
  const { data: adminAddress } = useEscrowAdmin();

  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!publicKey) {
    return (
      <div className={cardClass}>
        <h3 id={HEADING_ID} className={sectionTitleClass}>
          Open a dispute
        </h3>
        <p className="mt-2 text-body-sm text-soil-600">
          Connect your wallet to open a dispute on this campaign.
        </p>
      </div>
    );
  }

  const isFarmer = publicKey === farmerAddress;
  const isContributor = (contribution ?? 0n) > 0n;
  const isAdmin = publicKey === adminAddress;
  const canOpenDispute = isFarmer || isContributor || isAdmin;

  if (!canOpenDispute) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    if (reason.trim().length === 0) {
      setFormError('Enter a reason for the dispute.');
      return;
    }

    try {
      await openDispute.mutateAsync({
        campaignId,
        opener: publicKey!,
        reason: reason.trim(),
      });
      setSuccess(true);
      setReason('');
    } catch (err) {
      setFormError(toUserFacingError(err));
    }
  }

  const isReasonError = formError !== null && reason.trim().length === 0;
  const errorId = isReasonError ? REASON_ERROR_ID : FORM_ERROR_ID;

  return (
    <div className={cardClass}>
      <form
        onSubmit={handleSubmit}
        className="space-y-3"
        aria-labelledby={HEADING_ID}
        noValidate
      >
        <h3 id={HEADING_ID} className={sectionTitleClass}>
          Open a dispute
        </h3>
        <p className="text-body-sm text-soil-600">
          Raising a dispute pauses fund releases until an admin resolves it.
        </p>
        <div>
          <label className={labelClass} htmlFor="dispute-reason">
            Reason
          </label>
          <textarea
            id="dispute-reason"
            className={inputClass}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why you're opening this dispute..."
            aria-required="true"
            aria-invalid={isReasonError}
            aria-describedby={formError ? errorId : undefined}
          />
        </div>
        <button
          type="submit"
          disabled={openDispute.isPending}
          className={primaryButtonClass}
        >
          {openDispute.isPending ? 'Confirm in wallet…' : 'Open dispute'}
        </button>
        <ActionError message={formError} id={errorId} />
        {success && (
          <p role="status" className="text-caption text-status-active-dark">
            Dispute opened.
          </p>
        )}
      </form>
    </div>
  );
}
