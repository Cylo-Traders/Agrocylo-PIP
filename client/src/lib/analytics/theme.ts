import type { CampaignStatus } from './metrics';

// Mirrors client/tailwind.config.ts - Recharts needs literal hex values, not
// Tailwind utility classes, so these are kept in sync with that file by hand.
export const CHART_COLORS = {
  leaf: '#4d933e',
  amber: '#f5bd2a',
  soil: '#9c7740',
  bark: '#9c7b59',
} as const;

export const STATUS_COLORS: Record<CampaignStatus, string> = {
  Active: '#3a762e',
  Funding: '#2563eb',
  Funded: '#4f46e5',
  InProduction: '#0d9488',
  Harvested: '#f5bd2a',
  Disputed: '#ea580c',
  Resolved: '#059669',
  Settled: '#64748b',
  Failed: '#dc2626',
};

export const OUTCOME_COLORS = [CHART_COLORS.leaf, '#2563eb', '#dc2626'];
