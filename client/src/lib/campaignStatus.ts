import type { CampaignStatusTag } from './soroban/types';

export interface StatusMeta {
  label: string;
  bg: string;
  bgLight: string;
  text: string;
  border: string;
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
 * The "happy path" lifecycle steps shown in the campaign stepper.
 * `statuses` lists every CampaignStatus that maps onto that step — Active and
 * Funding both represent the funding phase (a campaign starts Active and
 * flips to Funding on its first contribution).
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

/**
 * Index into LIFECYCLE_STEPS the campaign is at (or most recently passed
 * through) for statuses that branch off the happy path.
 */
export function lifecycleStepIndex(status: CampaignStatusTag): number {
  const direct = LIFECYCLE_STEPS.findIndex((step) =>
    step.statuses.includes(status),
  );
  if (direct !== -1) return direct;
  // Disputed/Resolved/Failed can occur from Active, Funding, or Funded — we
  // can't tell which without more history, so anchor on "funded" as the
  // latest point a dispute/failure could realistically occur from.
  return 1;
}
