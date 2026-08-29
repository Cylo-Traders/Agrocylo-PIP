import type { CampaignStatusTag } from './soroban/types';

export interface StatusMeta {
  label: string;
  bg: string;
  bgLight: string;
  text: string;
  border: string;
}

/**
 * Signals used to derive the UI-only "in production" presentation from a
 * still-`Funded` campaign. Not an on-chain status — see
 * {@link isDerivedInProduction}.
 */
export interface ProductionProgress {
  /** Tranche records from `get_tranches`. */
  tranches?: ReadonlyArray<{ released: boolean }>;
  /** `Campaign.released` from `get_campaign` (contract units). */
  releasedAmount?: bigint | number;
}

/** Tailwind class sets per CampaignStatus, matching the palette in tailwind.config.ts. */
export const STATUS_META: Record<CampaignStatusTag, StatusMeta> = {
  Active: {
    label: 'Active',
    bg: 'bg-status-active',
    bgLight: 'bg-status-active-light',
    text: 'text-status-active-dark',
    border: 'border-status-active/20',
  },
  Funding: {
    label: 'Funding',
    bg: 'bg-status-funding',
    bgLight: 'bg-status-funding-light',
    text: 'text-status-funding-dark',
    border: 'border-status-funding/20',
  },
  Funded: {
    label: 'Funded',
    bg: 'bg-status-funded',
    bgLight: 'bg-status-funded-light',
    text: 'text-status-funded-dark',
    border: 'border-status-funded/20',
  },
  InProduction: {
    label: 'In Production',
    bg: 'bg-status-inproduction',
    bgLight: 'bg-status-inproduction-light',
    text: 'text-status-inproduction-dark',
    border: 'border-status-inproduction/20',
  },
  Harvested: {
    label: 'Harvested',
    bg: 'bg-status-harvested',
    bgLight: 'bg-status-harvested-light',
    text: 'text-status-harvested-dark',
    border: 'border-status-harvested/20',
  },
  Disputed: {
    label: 'Disputed',
    bg: 'bg-status-disputed',
    bgLight: 'bg-status-disputed-light',
    text: 'text-status-disputed-dark',
    border: 'border-status-disputed/20',
  },
  Resolved: {
    label: 'Resolved',
    bg: 'bg-status-resolved',
    bgLight: 'bg-status-resolved-light',
    text: 'text-status-resolved-dark',
    border: 'border-status-resolved/20',
  },
  Settled: {
    label: 'Settled',
    bg: 'bg-status-settled',
    bgLight: 'bg-status-settled-light',
    text: 'text-status-settled-dark',
    border: 'border-status-settled/20',
  },
  Failed: {
    label: 'Failed',
    bg: 'bg-status-failed',
    bgLight: 'bg-status-failed-light',
    text: 'text-status-failed-dark',
    border: 'border-status-failed/20',
  },
};

/**
 * Statuses where at least one of the five admin actions is applicable.
 * Every entry is an on-chain `CampaignStatusTag` — never a UI-only derived
 * label. `InProduction` is included because `release_tranche` writes that
 * variant on-chain (see `contracts/production_escrow/src/lib.rs`).
 */
export const ACTIONABLE_STATUSES: readonly CampaignStatusTag[] = [
  'Active',
  'Funding',
  'Funded',
  'InProduction',
  'Harvested',
  'Disputed',
];

/**
 * True when a campaign is still tagged `Funded` on-chain but production has
 * already started — at least one tranche is released, or `released` on the
 * campaign is > 0. This is a presentational state, not a chain tag.
 *
 * On-chain `InProduction` is handled separately (it is a real contract
 * variant); this helper only covers the Funded + progress case so the
 * stepper is not stuck on "Funded" after the first release.
 */
export function isDerivedInProduction(
  status: CampaignStatusTag,
  progress?: ProductionProgress,
): boolean {
  if (status !== 'Funded') return false;
  if (progress?.tranches?.some((tranche) => tranche.released)) return true;
  const released = progress?.releasedAmount;
  if (released === undefined) return false;
  return typeof released === 'bigint' ? released > 0n : released > 0;
}

/**
 * Status to show in badges. Maps Funded + released-tranche progress onto
 * the existing on-chain `InProduction` presentation without inventing a
 * new tag in `CampaignStatusTag`.
 */
export function presentationalCampaignStatus(
  status: CampaignStatusTag,
  progress?: ProductionProgress,
): CampaignStatusTag {
  return isDerivedInProduction(status, progress) ? 'InProduction' : status;
}

/**
 * The "happy path" lifecycle steps shown in the campaign stepper.
 * `statuses` lists every *on-chain* CampaignStatus that maps onto that step
 * — Active and Funding both represent the funding phase (a campaign starts
 * Active and flips to Funding on its first contribution).
 *
 * The production step is reached by the on-chain `InProduction` tag *or* by
 * a Funded campaign with released-tranche progress (see
 * {@link isDerivedInProduction}); Funded is intentionally not listed here
 * so an unreleased Funded campaign stays on the Funded step.
 */
export const LIFECYCLE_STEPS: {
  key: string;
  label: string;
  statuses: CampaignStatusTag[];
}[] = [
  { key: 'funding', label: 'Funding', statuses: ['Active', 'Funding'] },
  { key: 'funded', label: 'Funded', statuses: ['Funded'] },
  { key: 'production', label: 'In Production', statuses: ['InProduction'] },
  { key: 'harvested', label: 'Harvested', statuses: ['Harvested'] },
  { key: 'settled', label: 'Settled', statuses: ['Settled'] },
];

const PRODUCTION_STEP_INDEX = LIFECYCLE_STEPS.findIndex(
  (step) => step.key === 'production',
);

/**
 * Index into LIFECYCLE_STEPS the campaign is at (or most recently passed
 * through) for statuses that branch off the happy path.
 *
 * Pass `progress` so a Funded campaign that has already released a tranche
 * advances to the In Production step instead of remaining on Funded.
 */
export function lifecycleStepIndex(
  status: CampaignStatusTag,
  progress?: ProductionProgress,
): number {
  if (isDerivedInProduction(status, progress)) {
    return PRODUCTION_STEP_INDEX;
  }
  const direct = LIFECYCLE_STEPS.findIndex((step) =>
    step.statuses.includes(status),
  );
  if (direct !== -1) return direct;
  // Disputed/Resolved/Failed can occur from Active, Funding, or Funded — we
  // can't tell which without more history, so anchor on "funded" as the
  // latest point a dispute/failure could realistically occur from.
  return 1;
}
