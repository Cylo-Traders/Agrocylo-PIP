import React, { useState } from 'react';
import { Modal } from '../ui/Modal/Modal';
import { useWallet } from '../../context/WalletContext';
import { useFundCampaign } from '../../hooks/contract/useEscrowMutations';
import {
  validateContribution,
  calculateOwnershipShare,
} from '../../lib/soroban/campaignService';
import { toUserFacingError } from '../../lib/soroban/userFacingError';

const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-3 shadow-campaign';
const primaryButtonClass =
  'rounded-lg bg-leaf-700 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-leaf-800 disabled:opacity-50';
const secondaryButtonClass =
  'rounded-lg border border-soil-300 px-4 py-2.5 font-medium text-soil-700 transition hover:bg-soil-50 disabled:opacity-50';
const inputClass =
  'w-full rounded-lg border border-soil-300 bg-white px-4 py-2.5 pl-8 text-body-sm text-soil-900 outline-none transition focus:border-leaf-500 focus:ring-1 focus:ring-leaf-500';
const labelClass = 'mb-1 block text-body-sm font-medium text-soil-700';

export interface FundCampaignResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface FundCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignTitle: string;
  totalTarget: number;
  currentRaised: number;
  onSuccess?: (result: FundCampaignResult, addedAmount: number) => void;
}

export const FundCampaignModal: React.FC<FundCampaignModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  campaignTitle,
  totalTarget,
  currentRaised,
  onSuccess,
}) => {
  const { isConnected, publicKey } = useWallet();
  const fundCampaignMutation = useFundCampaign();

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

    if (!isConnected || !publicKey) {
      setError('Wallet must be connected to fund a campaign');
      return;
    }

    const validation = validateContribution(numAmount, remainingTarget);
    if (!validation.valid) {
      setError(validation.error || 'Invalid contribution amount');
      return;
    }

    setLoading(true);
    try {
      const parsedAmount = BigInt(Math.round(numAmount));
      await fundCampaignMutation.mutateAsync({
        campaignId,
        investor: publicKey,
        amount: parsedAmount,
      });

      const res: FundCampaignResult = {
        success: true,
        txHash: 'Confirmed on-chain',
      };

      setSuccessResult(res);
      if (onSuccess) {
        onSuccess(res, numAmount);
      }
    } catch (err) {
      const message = toUserFacingError(err);
      setError(message);
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
          <span className="mt-1 block text-body-sm font-normal text-soil-500">
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
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-status-resolved-light text-2xl font-bold text-status-resolved"
            aria-hidden="true"
          >
            ✓
          </div>
          <h3 className="text-h4 text-soil-900">Contribution Successful!</h3>
          <p className="text-body-sm text-soil-600">
            You contributed{' '}
            <span className="font-semibold text-status-resolved">
              ${numAmount.toLocaleString()}
            </span>{' '}
            to {campaignTitle}.
          </p>

          {successResult.txHash && (
            <div className={cardClass}>
              <span className="block font-mono text-caption text-soil-500">
                Transaction Status
              </span>
              <span className="break-all font-mono text-caption text-soil-700">
                {successResult.txHash}
              </span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className={`${primaryButtonClass} w-full`}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        /* Input Form View */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Wallet disconnection prompt */}
          {!isConnected && (
            <div
              role="status"
              className="rounded-campaign border border-status-harvested/20 bg-status-harvested-light p-3 text-body-sm font-medium text-status-harvested-dark"
            >
              Connect your wallet to fund this campaign.
            </div>
          )}

          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-3 rounded-campaign border border-soil-100 bg-soil-50 p-3">
            <div>
              <span className="block text-caption text-soil-500">
                Remaining Target
              </span>
              <span className="text-body-sm font-semibold text-soil-900">
                ${remainingTarget.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="block text-caption text-soil-500">
                Est. Share
              </span>
              <span className="text-body-sm font-semibold text-status-resolved">
                {estimatedShare}%
              </span>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div
              id="contribution-amount-error"
              role="alert"
              className="rounded-campaign border border-status-failed/20 bg-status-failed-light p-3 text-body-sm text-status-failed-dark"
            >
              {error}
            </div>
          )}

          {/* Input field */}
          <div>
            <label htmlFor="contribution-amount" className={labelClass}>
              Contribution Amount (USDC)
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-soil-500"
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
                className={inputClass}
              />
            </div>
          </div>

          {/* Quick selectors */}
          <div className="flex items-center gap-2">
            <span className="text-caption text-soil-500">Quick fill:</span>
            {[25, 50, 100].map((pct) => (
              <button
                type="button"
                key={pct}
                onClick={() => handlePercentageSelect(pct)}
                className="rounded-lg border border-soil-200 px-2.5 py-1 text-caption text-soil-600 transition hover:bg-soil-50"
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-soil-100 pt-3">
            <button
              type="button"
              onClick={resetAndClose}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || remainingTarget <= 0 || !isConnected}
              className={primaryButtonClass}
            >
              {loading ? 'Confirming...' : 'Confirm Contribution'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
