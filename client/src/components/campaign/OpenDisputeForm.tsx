import { useState } from 'react';
import type { FormEvent } from 'react';
import { useWallet } from '../../context/WalletContext';
import {
  useContribution,
  useDispute,
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
const labelClass = 'mb-1 block text-label text-soil-500';
const errorClass = 'mt-1 text-caption text-status-failed-dark';
const sectionTitleClass = 'text-h4 text-soil-900';

function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className={errorClass}>{message}</p>;
}

export interface OpenDisputeFormProps {
  campaignId: string;
  farmerAddress: string;
}

/**
 * Lets a campaign's farmer, a contributing investor, or the escrow admin
 * open a dispute. Eligibility is a UX convenience only — `open_dispute`
 * enforces the same set on-chain via `.require_auth()`.
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
  const { data: dispute } = useDispute(campaignId);

  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasOpenDispute = dispute?.status?.tag === 'Open';

  if (!publicKey) {
    return (
      <div className={cardClass}>
        <h3 className={sectionTitleClass}>Open a dispute</h3>
        <p className="mt-2 text-body-sm text-soil-500">
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

  if (hasOpenDispute) {
    return (
      <div className={cardClass}>
        <h3 className={sectionTitleClass}>Open a dispute</h3>
        <p className="mt-2 text-body-sm text-soil-500" role="status">
          A dispute is already open on this campaign — an admin needs to resolve
          it before a new one can be opened.
        </p>
      </div>
    );
  }

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

  return (
    <div className={cardClass}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className={sectionTitleClass}>Open a dispute</h3>
        <p className="text-body-sm text-soil-500">
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
            placeholder="Describe why you're opening this dispute…"
          />
        </div>
        <button
          type="submit"
          disabled={openDispute.isPending}
          className={primaryButtonClass}
        >
          {openDispute.isPending ? 'Confirm in wallet…' : 'Open dispute'}
        </button>
        <ActionError message={formError} />
        {success && (
          <p className="text-caption text-status-active-dark">
            Dispute opened.
          </p>
        )}
      </form>
    </div>
  );
}
