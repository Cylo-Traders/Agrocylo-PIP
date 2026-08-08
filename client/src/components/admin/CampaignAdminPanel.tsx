import { useState } from 'react';
import type { FormEvent } from 'react';
import { StrKey } from '@stellar/stellar-sdk';
import { StatusBadge } from '../campaign/StatusBadge';
import { LifecycleStepper } from '../campaign/LifecycleStepper';
import {
  useConfigureTranches,
  useReleaseTranche,
  useResolveDispute,
  useSettleCampaign,
  useMarkFailed,
  useDispute,
} from '../../hooks/contract';
import { toUserFacingError } from '../../lib/soroban/userFacingError';
import {
  CONTRACT_SYMBOL_HINT,
  isValidContractSymbol,
} from '../../lib/soroban/symbol';
import type { AdminCampaignOverview } from '../../hooks/useAdminCampaigns';
import type { DisputeResolutionTag } from '../../lib/soroban/types';

const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign';
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-leaf-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-soil-300 px-4 py-2 text-sm font-semibold text-soil-700 transition-colors hover:bg-soil-50 disabled:cursor-not-allowed disabled:opacity-50';
const dangerButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-status-failed-dark px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-status-failed focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputClass =
  'w-full rounded-lg border border-soil-300 px-3 py-2 text-body-sm text-soil-900 focus:border-leaf-500 focus:outline-none focus:ring-1 focus:ring-leaf-500';
const labelClass = 'mb-1 block text-label text-soil-500';
const errorClass = 'mt-1 text-caption text-status-failed-dark';
const hintClass = 'mt-1 text-caption text-soil-400';
const sectionTitleClass = 'text-h4 text-soil-900';

/** Funds still held in escrow — mirrors `escrow_held` in the contract. */
function escrowHeld(campaign: AdminCampaignOverview['campaign']): bigint {
  return (
    campaign.total_funded -
    campaign.released -
    campaign.refundable -
    campaign.returnable
  );
}

function parseWholeAmount(value: string): bigint | null {
  if (!/^\d+$/.test(value.trim())) return null;
  try {
    return BigInt(value.trim());
  } catch {
    return null;
  }
}

function isValidAddress(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value);
}

function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className={errorClass}>{message}</p>;
}

// ─── Configure tranches ──────────────────────────────────────────────────────

interface TrancheRow {
  amount: string;
  milestone: string;
}

function ConfigureTranchesForm({
  campaignId,
  totalFunded,
}: {
  campaignId: string;
  totalFunded: bigint;
}) {
  const configureTranches = useConfigureTranches();
  const [rows, setRows] = useState<TrancheRow[]>([
    { amount: '', milestone: '' },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function updateRow(index: number, patch: Partial<TrancheRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { amount: '', milestone: '' }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): { amount: bigint; milestone: string }[] | string {
    if (rows.length === 0) return 'Add at least one tranche.';
    const parsed: { amount: bigint; milestone: string }[] = [];
    let sum = 0n;
    for (const row of rows) {
      const amount = parseWholeAmount(row.amount);
      if (amount === null || amount <= 0n) {
        return 'Each tranche amount must be a whole number greater than zero.';
      }
      if (!isValidContractSymbol(row.milestone)) {
        return `Milestone label: ${CONTRACT_SYMBOL_HINT}`;
      }
      sum += amount;
      parsed.push({ amount, milestone: row.milestone });
    }
    if (sum > totalFunded) {
      return 'Total tranche amounts exceed the funded amount.';
    }
    return parsed;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);
    const result = validate();
    if (typeof result === 'string') {
      setFormError(result);
      return;
    }
    try {
      await configureTranches.mutateAsync({ campaignId, tranches: result });
      setSuccess(true);
      setRows([{ amount: '', milestone: '' }]);
    } catch (err) {
      setFormError(toUserFacingError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className={sectionTitleClass}>Configure tranches</h3>
      <p className="text-body-sm text-soil-500">
        Funded total: {totalFunded.toString()} (contract units)
      </p>
      {rows.map((row, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="flex-1">
            <label className={labelClass} htmlFor={`tranche-amount-${index}`}>
              Amount
            </label>
            <input
              id={`tranche-amount-${index}`}
              className={inputClass}
              inputMode="numeric"
              value={row.amount}
              onChange={(e) => updateRow(index, { amount: e.target.value })}
              placeholder="10000"
            />
          </div>
          <div className="flex-1">
            <label
              className={labelClass}
              htmlFor={`tranche-milestone-${index}`}
            >
              Milestone
            </label>
            <input
              id={`tranche-milestone-${index}`}
              className={inputClass}
              value={row.milestone}
              onChange={(e) => updateRow(index, { milestone: e.target.value })}
              placeholder="planting"
            />
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(index)}
              className={`${secondaryButtonClass} mb-0`}
              aria-label="Remove tranche"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={addRow} className={secondaryButtonClass}>
          Add tranche
        </button>
        <button
          type="submit"
          disabled={configureTranches.isPending}
          className={primaryButtonClass}
        >
          {configureTranches.isPending
            ? 'Confirm in wallet…'
            : 'Configure tranches'}
        </button>
      </div>
      <ActionError message={formError} />
      {success && (
        <p className="text-caption text-status-active-dark">
          Tranches configured.
        </p>
      )}
    </form>
  );
}

// ─── Release tranche ─────────────────────────────────────────────────────────

function ReleaseTrancheForm({
  campaignId,
  farmerAddress,
  heldAmount,
}: {
  campaignId: string;
  farmerAddress: string;
  heldAmount: bigint;
}) {
  const releaseTranche = useReleaseTranche();
  const [recipient, setRecipient] = useState(farmerAddress);
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    if (!isValidAddress(recipient)) {
      setFormError('Enter a valid recipient address.');
      return;
    }
    const parsedAmount = parseWholeAmount(amount);
    if (parsedAmount === null || parsedAmount <= 0n) {
      setFormError('Enter a whole number greater than zero.');
      return;
    }
    if (parsedAmount > heldAmount) {
      setFormError(
        `Amount exceeds the escrow balance still held (${heldAmount.toString()}).`,
      );
      return;
    }

    try {
      await releaseTranche.mutateAsync({
        campaignId,
        recipient,
        amount: parsedAmount,
      });
      setSuccess(true);
      setAmount('');
    } catch (err) {
      setFormError(toUserFacingError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className={sectionTitleClass}>Release tranche</h3>
      <p className="text-body-sm text-soil-500">
        Escrow held: {heldAmount.toString()} (contract units)
      </p>
      <div>
        <label className={labelClass} htmlFor="release-recipient">
          Recipient
        </label>
        <input
          id="release-recipient"
          className={`${inputClass} font-mono`}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="release-amount">
          Amount
        </label>
        <input
          id="release-amount"
          className={inputClass}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="5000"
        />
      </div>
      <button
        type="submit"
        disabled={releaseTranche.isPending}
        className={primaryButtonClass}
      >
        {releaseTranche.isPending ? 'Confirm in wallet…' : 'Release tranche'}
      </button>
      <ActionError message={formError} />
      {success && (
        <p className="text-caption text-status-active-dark">
          Tranche released.
        </p>
      )}
    </form>
  );
}

// ─── Resolve dispute ─────────────────────────────────────────────────────────

const RESOLUTION_OPTIONS: { value: DisputeResolutionTag; label: string }[] = [
  { value: 'FullRefund', label: 'Full refund to investors' },
  { value: 'FullPayout', label: 'Full payout to farmer' },
  { value: 'PartialSettlement', label: 'Partial settlement' },
];

function ResolveDisputeForm({
  campaignId,
  heldAmount,
}: {
  campaignId: string;
  heldAmount: bigint;
}) {
  const resolveDispute = useResolveDispute();
  const disputeQuery = useDispute(campaignId);
  const [resolution, setResolution] =
    useState<DisputeResolutionTag>('FullRefund');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastSplit, setLastSplit] = useState<{
    farmer: bigint;
    refundable: bigint;
  } | null>(null);

  const partialParsed =
    resolution === 'PartialSettlement'
      ? parseWholeAmount(payoutAmount)
      : null;
  const previewSplit = (() => {
    if (resolution === 'FullRefund') {
      return { farmer: 0n, refundable: heldAmount };
    }
    if (resolution === 'FullPayout') {
      return { farmer: heldAmount, refundable: 0n };
    }
    if (
      partialParsed !== null &&
      partialParsed > 0n &&
      partialParsed < heldAmount
    ) {
      return {
        farmer: partialParsed,
        refundable: heldAmount - partialParsed,
      };
    }
    return null;
  })();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);
    setLastSplit(null);

    let amount = 0n;
    if (resolution === 'PartialSettlement') {
      const parsed = parseWholeAmount(payoutAmount);
      if (parsed === null || parsed <= 0n || parsed >= heldAmount) {
        setFormError(
          `Partial settlement payout must be greater than zero and less than the held amount (${heldAmount.toString()}).`,
        );
        return;
      }
      amount = parsed;
    }
    // FullRefund / FullPayout always submit zero payout (contract requirement).

    try {
      await resolveDispute.mutateAsync({
        campaignId,
        resolution,
        payoutAmount: amount,
      });
      const farmer =
        resolution === 'FullPayout'
          ? heldAmount
          : resolution === 'PartialSettlement'
            ? amount
            : 0n;
      setLastSplit({
        farmer,
        refundable: heldAmount - farmer,
      });
      setSuccess(true);
      setPayoutAmount('');
    } catch (err) {
      setFormError(toUserFacingError(err));
    }
  }

  const dispute = disputeQuery.data;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3"
      data-testid="resolve-dispute-form"
    >
      <h3 className={sectionTitleClass}>Resolve dispute</h3>
      <p className="text-body-sm text-soil-500">
        Escrow held:{' '}
        <span className="font-semibold text-soil-800">
          {heldAmount.toString()}
        </span>{' '}
        (contract units). Full refund / full payout submit with a zero payout
        amount automatically.
      </p>

      {disputeQuery.isLoading && (
        <p className="text-caption text-soil-400">Loading dispute details…</p>
      )}
      {dispute && (
        <dl
          className="grid grid-cols-1 gap-2 rounded-lg border border-soil-200 bg-soil-50 p-3 text-body-sm sm:grid-cols-2"
          data-testid="dispute-details"
        >
          <div>
            <dt className="text-caption text-soil-400">Opener</dt>
            <dd className="break-all font-mono text-soil-800">
              {dispute.opener}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-soil-400">Reason</dt>
            <dd className="font-mono text-soil-800">{dispute.reason}</dd>
          </div>
          <div>
            <dt className="text-caption text-soil-400">Status</dt>
            <dd className="text-soil-800">{dispute.status.tag}</dd>
          </div>
        </dl>
      )}

      <div>
        <label className={labelClass} htmlFor="dispute-resolution">
          Resolution
        </label>
        <select
          id="dispute-resolution"
          className={inputClass}
          value={resolution}
          onChange={(e) =>
            setResolution(e.target.value as DisputeResolutionTag)
          }
        >
          {RESOLUTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {resolution === 'PartialSettlement' && (
        <div>
          <label className={labelClass} htmlFor="dispute-payout">
            Payout to farmer
          </label>
          <input
            id="dispute-payout"
            className={inputClass}
            inputMode="numeric"
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(e.target.value)}
            placeholder="1000"
          />
          <p className={hintClass}>
            Must be greater than zero and less than {heldAmount.toString()}.
          </p>
        </div>
      )}
      {previewSplit && (
        <p
          className="text-caption text-soil-600"
          data-testid="dispute-split-preview"
        >
          Preview — farmer payout: {previewSplit.farmer.toString()}, investor
          refundable: {previewSplit.refundable.toString()}
        </p>
      )}
      <button
        type="submit"
        disabled={resolveDispute.isPending}
        className={primaryButtonClass}
      >
        {resolveDispute.isPending ? 'Confirm in wallet…' : 'Resolve dispute'}
      </button>
      <ActionError message={formError} />
      {success && (
        <p className="text-caption text-status-active-dark">
          Dispute resolved
          {lastSplit
            ? ` — farmer ${lastSplit.farmer.toString()}, refundable ${lastSplit.refundable.toString()}. Campaign moves to Resolved and leaves the open-dispute queue.`
            : '.'}
        </p>
      )}
    </form>
  );
}

// ─── Settle campaign ─────────────────────────────────────────────────────────

function SettleCampaignForm({
  campaignId,
  farmerAddress,
  heldAmount,
}: {
  campaignId: string;
  farmerAddress: string;
  heldAmount: bigint;
}) {
  const settleCampaign = useSettleCampaign();
  const [farmerPayout, setFarmerPayout] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    const parsed = parseWholeAmount(farmerPayout);
    if (parsed === null) {
      setFormError('Enter a whole number of zero or greater.');
      return;
    }
    if (parsed > heldAmount) {
      setFormError(
        `Payout exceeds the escrow balance still held (${heldAmount.toString()}).`,
      );
      return;
    }

    try {
      await settleCampaign.mutateAsync({
        campaignId,
        farmer: farmerAddress,
        farmerPayout: parsed,
      });
      setSuccess(true);
      setFarmerPayout('');
    } catch (err) {
      setFormError(toUserFacingError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className={sectionTitleClass}>Settle campaign</h3>
      <p className="text-body-sm text-soil-500">
        Escrow held: {heldAmount.toString()} (contract units). The remainder
        becomes returnable to investors.
      </p>
      <div>
        <span className={labelClass}>Farmer</span>
        <p className="break-all font-mono text-body-sm text-soil-700">
          {farmerAddress}
        </p>
      </div>
      <div>
        <label className={labelClass} htmlFor="settle-farmer-payout">
          Farmer payout
        </label>
        <input
          id="settle-farmer-payout"
          className={inputClass}
          inputMode="numeric"
          value={farmerPayout}
          onChange={(e) => setFarmerPayout(e.target.value)}
          placeholder="0"
        />
      </div>
      <button
        type="submit"
        disabled={settleCampaign.isPending}
        className={primaryButtonClass}
      >
        {settleCampaign.isPending ? 'Confirm in wallet…' : 'Settle campaign'}
      </button>
      <ActionError message={formError} />
      {success && (
        <p className="text-caption text-status-active-dark">
          Campaign settled.
        </p>
      )}
    </form>
  );
}

// ─── Mark failed ─────────────────────────────────────────────────────────────

function MarkFailedForm({ campaignId }: { campaignId: string }) {
  const markFailed = useMarkFailed();
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleConfirm() {
    setFormError(null);
    setSuccess(false);
    try {
      await markFailed.mutateAsync({ campaignId });
      setSuccess(true);
      setConfirming(false);
    } catch (err) {
      setFormError(toUserFacingError(err));
    }
  }

  return (
    <div className="space-y-3">
      <h3 className={sectionTitleClass}>Mark failed</h3>
      <p className="text-body-sm text-soil-500">
        Marks the campaign as failed and makes escrowed funds refundable to
        investors. This cannot be undone.
      </p>
      {confirming ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={markFailed.isPending}
            className={dangerButtonClass}
          >
            {markFailed.isPending
              ? 'Confirm in wallet…'
              : 'Confirm: mark as failed'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={markFailed.isPending}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={dangerButtonClass}
        >
          Mark campaign as failed
        </button>
      )}
      <ActionError message={formError} />
      {success && (
        <p className="text-caption text-status-active-dark">
          Campaign marked as failed.
        </p>
      )}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function CampaignAdminPanel({
  overview,
}: {
  overview: AdminCampaignOverview;
}) {
  const { id, campaign } = overview;
  const status = campaign.status.tag;
  const held = escrowHeld(campaign);

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-label text-leaf-700">Campaign #{id}</p>
          <p className="mt-1 break-all font-mono text-caption text-soil-500">
            Farmer: {campaign.farmer}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-4">
        <LifecycleStepper status={status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-body-sm sm:grid-cols-4">
        <div>
          <dt className="text-caption text-soil-400">Target</dt>
          <dd className="font-semibold text-soil-900">
            {campaign.target_amount.toString()}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-soil-400">Funded</dt>
          <dd className="font-semibold text-soil-900">
            {campaign.total_funded.toString()}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-soil-400">Released</dt>
          <dd className="font-semibold text-soil-900">
            {campaign.released.toString()}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-soil-400">Held</dt>
          <dd className="font-semibold text-soil-900">{held.toString()}</dd>
        </div>
      </dl>

      <div className="mt-6 space-y-6 border-t border-soil-100 pt-6">
        {(status === 'Active' || status === 'Funding') && (
          <MarkFailedForm campaignId={id} />
        )}

        {status === 'Funded' && (
          <>
            <ConfigureTranchesForm
              campaignId={id}
              totalFunded={campaign.total_funded}
            />
            <ReleaseTrancheForm
              campaignId={id}
              farmerAddress={campaign.farmer}
              heldAmount={held}
            />
            <MarkFailedForm campaignId={id} />
          </>
        )}

        {status === 'InProduction' && (
          <>
            <ReleaseTrancheForm
              campaignId={id}
              farmerAddress={campaign.farmer}
              heldAmount={held}
            />
            <MarkFailedForm campaignId={id} />
          </>
        )}

        {status === 'Harvested' && (
          <>
            <SettleCampaignForm
              campaignId={id}
              farmerAddress={campaign.farmer}
              heldAmount={held}
            />
            <MarkFailedForm campaignId={id} />
          </>
        )}

        {status === 'Disputed' && (
          <ResolveDisputeForm campaignId={id} heldAmount={held} />
        )}
      </div>
    </div>
  );
}
