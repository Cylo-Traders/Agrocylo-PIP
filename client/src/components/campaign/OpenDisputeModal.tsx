import React, { useState } from 'react';
import { Modal } from '../ui/Modal/Modal';
import { useOpenDispute } from '../../hooks/contract/useEscrowMutations';
import {
  validateDisputeReason,
  DISPUTE_REASON_MAX_LENGTH,
  type DisputeOpenerRole,
} from '../../lib/dispute/eligibility';
import { toUserFacingError } from '../../lib/soroban/userFacingError';

export interface OpenDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignTitle: string;
  /** Connected wallet opening the dispute. */
  opener: string;
  /** Which authorization rule granted access, shown as context in the form. */
  role: DisputeOpenerRole;
  /** Fired after the contract call succeeds, with the submitted reason. */
  onSuccess?: (reason: string) => void;
}

const ROLE_LABEL: Record<DisputeOpenerRole, string> = {
  farmer: 'campaign farmer',
  contributor: 'contributing investor',
  admin: 'platform admin',
};

export const OpenDisputeModal: React.FC<OpenDisputeModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  campaignTitle,
  opener,
  role,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const openDispute = useOpenDispute();

  if (!isOpen) return null;

  const handleClose = () => {
    setReason('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateDisputeReason(reason);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setError(null);
    const trimmed = reason.trim();

    try {
      await openDispute.mutateAsync({ campaignId, opener, reason: trimmed });
      setReason('');
      onSuccess?.(trimmed);
      onClose();
    } catch (err) {
      setError(toUserFacingError(err));
    }
  };

  const remaining = DISPUTE_REASON_MAX_LENGTH - reason.trim().length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Open a dispute"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          You are opening a dispute on{' '}
          <span className="font-semibold text-slate-900 dark:text-white">
            {campaignTitle}
          </span>{' '}
          as the {ROLE_LABEL[role]}. This moves the campaign to{' '}
          <span className="font-semibold">Disputed</span> and pauses fund
          release until an admin resolves it.
        </p>

        <div className="space-y-1">
          <label
            htmlFor="dispute-reason"
            className="block text-sm font-medium text-slate-900 dark:text-white"
          >
            Reason <span className="text-red-600">*</span>
          </label>
          <textarea
            id="dispute-reason"
            required
            rows={4}
            value={reason}
            maxLength={DISPUTE_REASON_MAX_LENGTH}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'dispute-reason-error' : undefined}
            placeholder="Describe the issue with this campaign…"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>Required — this is stored on-chain.</span>
            <span>{remaining} characters left</span>
          </div>
        </div>

        {error && (
          <p
            id="dispute-reason-error"
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={handleClose}
            disabled={openDispute.isPending}
            className="rounded-xl px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={openDispute.isPending}
            className="rounded-xl bg-red-700 px-5 py-2 font-semibold text-white shadow-md transition hover:bg-red-800 disabled:opacity-50"
          >
            {openDispute.isPending ? 'Opening dispute…' : 'Open dispute'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default OpenDisputeModal;
