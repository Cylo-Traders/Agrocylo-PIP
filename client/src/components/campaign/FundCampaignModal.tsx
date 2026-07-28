import React, { useState } from 'react';
import { Modal } from '../ui/Modal/Modal';
import { useToast } from '../../context/ToastContext';
import {
  validateContribution,
  calculateOwnershipShare,
  fundCampaign,
  type FundCampaignResult,
} from '../../lib/soroban/campaignService';
import { toUserFacingError } from '../../lib/soroban/userFacingError';

export interface FundCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignTitle: string;
  totalTarget: number;
  currentRaised: number;
  walletAddress?: string;
  onSuccess?: (result: FundCampaignResult, addedAmount: number) => void;
}

export const FundCampaignModal: React.FC<FundCampaignModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  campaignTitle,
  totalTarget,
  currentRaised,
  walletAddress = 'GDF4...M9XZ',
  onSuccess,
}) => {
  const toast = useToast();
  const remainingTarget = Math.max(0, totalTarget - currentRaised);

  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<FundCampaignResult | null>(
    null,
  );

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const estimatedShare = calculateOwnershipShare(numAmount, totalTarget);

  const handlePercentageSelect = (percentage: number) => {
    const calculated = Math.round((remainingTarget * percentage) / 100);
    setAmount(calculated.toString());
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validateContribution(numAmount, remainingTarget);
    if (!validation.valid) {
      setError(validation.error || 'Invalid contribution amount');
      return;
    }

    setLoading(true);
    try {
      const res = await fundCampaign(
        { campaignId, amount: numAmount, walletAddress },
        currentRaised,
        totalTarget,
      );

      if (!res.success) {
        const message = res.error || 'Failed to fund campaign';
        setError(message);
        toast.error('Could not fund campaign', message);
      } else {
        setSuccessResult(res);
        toast.success(
          'Contribution successful',
          `You funded ${campaignTitle} with $${numAmount.toLocaleString()}.`,
        );
        if (onSuccess) {
          onSuccess(res, numAmount);
        }
      }
    } catch (err) {
      const message = toUserFacingError(err);
      setError(message);
      toast.error('Could not fund campaign', message);
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setAmount('');
    setError(null);
    setSuccessResult(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={
        <>
          Fund Campaign
          <span className="mt-1 block text-sm font-normal text-slate-500 dark:text-slate-400">
            {campaignTitle}
          </span>
        </>
      }
      size="md"
    >
      {/* Success View */}
      {successResult ? (
        <div className="space-y-4 py-2 text-center">
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
            aria-hidden="true"
          >
            ✓
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Contribution Successful!
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You contributed{' '}
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              ${numAmount.toLocaleString()}
            </span>{' '}
            to {campaignTitle}.
          </p>

          {successResult.txHash && (
            <div className="rounded-xl bg-slate-50 p-3 text-left dark:bg-slate-800/60">
              <span className="block font-mono text-xs text-slate-600 dark:text-slate-400">
                Transaction Hash
              </span>
              <span className="break-all font-mono text-xs text-slate-700 dark:text-slate-300">
                {successResult.txHash}
              </span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-medium text-white transition hover:bg-emerald-800"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        /* Input Form View */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <span className="block text-xs text-slate-600 dark:text-slate-400">
                Remaining Target
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                ${remainingTarget.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-600 dark:text-slate-400">
                Est. Share
              </span>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {estimatedShare}%
              </span>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div
              id="contribution-amount-error"
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {/* Input field */}
          <div>
            <label
              htmlFor="contribution-amount"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Contribution Amount (USDC)
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-600 dark:text-slate-400"
                aria-hidden="true"
              >
                $
              </span>
              <input
                id="contribution-amount"
                type="number"
                min="1"
                max={remainingTarget}
                step="any"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 500"
                aria-invalid={!!error}
                aria-describedby={
                  error ? 'contribution-amount-error' : undefined
                }
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-8 pr-4 text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Quick selectors */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Quick fill:
            </span>
            {[25, 50, 100].map((pct) => (
              <button
                type="button"
                key={pct}
                onClick={() => handlePercentageSelect(pct)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || remainingTarget <= 0}
              className="rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
            >
              {loading ? 'Confirming...' : 'Confirm Contribution'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
