import type { EscrowEvent } from '../soroban/events';

export type CampaignStatus =
  | 'Active'
  | 'Funding'
  | 'Funded'
  | 'InProduction'
  | 'Harvested'
  | 'Disputed'
  | 'Resolved'
  | 'Settled'
  | 'Failed';

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  'Active',
  'Funding',
  'Funded',
  'InProduction',
  'Harvested',
  'Disputed',
  'Resolved',
  'Settled',
  'Failed',
];

/** Statuses reached only after a campaign's funding target was met. */
const TARGET_REACHED_STATUSES = new Set<CampaignStatus>([
  'Funded',
  'InProduction',
  'Harvested',
  'Disputed',
  'Resolved',
  'Settled',
]);

export interface FundingVolumePoint {
  date: string;
  amount: number;
}

export interface StatusCount {
  status: CampaignStatus;
  count: number;
}

export interface SizeBucket {
  label: string;
  count: number;
}

export interface FundingOutcomeSlice {
  label: string;
  value: number;
}

export interface AnalyticsMetrics {
  totalCampaigns: number;
  totalVolume: number;
  averageCampaignSize: number;
  fundingSuccessRatePercent: number;
  fundingVolumeOverTime: FundingVolumePoint[];
  campaignsByStatus: StatusCount[];
  campaignSizeDistribution: SizeBucket[];
  fundingOutcome: FundingOutcomeSlice[];
}

interface CampaignAccumulator {
  targetAmount: number | null;
  status: CampaignStatus;
}

function toNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  return Number(value ?? 0);
}

function dayKey(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Replays ProductionEscrowContract events (in ledger order) into campaign
 * accumulators and derived chart-ready metrics. Pure function - no I/O.
 */
export function computeAnalyticsMetrics(
  rawEvents: EscrowEvent[],
): AnalyticsMetrics {
  const events = [...rawEvents].sort((a, b) => a.ledger - b.ledger);

  const campaigns = new Map<string, CampaignAccumulator>();
  const volumeByDay = new Map<string, number>();
  let totalVolume = 0;

  for (const event of events) {
    if (!event.campaignId) continue;

    switch (event.name) {
      case 'CampaignCreated': {
        const [, timestamp, targetAmount] = event.values;
        campaigns.set(event.campaignId, {
          targetAmount: toNumber(targetAmount),
          status: 'Active',
        });
        void timestamp;
        break;
      }
      case 'ContribReceived': {
        const [, timestamp, amount] = event.values;
        const amountNum = toNumber(amount);
        totalVolume += amountNum;
        const key = dayKey(toNumber(timestamp));
        volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + amountNum);

        const campaign = campaigns.get(event.campaignId);
        if (campaign && campaign.status === 'Active') {
          campaign.status = 'Funding';
        }
        break;
      }
      case 'CampaignFunded': {
        const campaign = campaigns.get(event.campaignId);
        if (campaign) campaign.status = 'Funded';
        break;
      }
      case 'TrancheReleased': {
        const campaign = campaigns.get(event.campaignId);
        if (campaign && campaign.status === 'Funded') {
          campaign.status = 'InProduction';
        }
        break;
      }
      case 'CampaignFailed': {
        const campaign = campaigns.get(event.campaignId);
        if (campaign) campaign.status = 'Failed';
        break;
      }
      case 'HarvestReported': {
        const campaign = campaigns.get(event.campaignId);
        if (campaign) campaign.status = 'Harvested';
        break;
      }
      case 'DisputeOpened': {
        const campaign = campaigns.get(event.campaignId);
        if (campaign) campaign.status = 'Disputed';
        break;
      }
      case 'DisputeResolved': {
        const campaign = campaigns.get(event.campaignId);
        if (campaign) campaign.status = 'Resolved';
        break;
      }
      case 'CampaignSettled': {
        const campaign = campaigns.get(event.campaignId);
        if (campaign) campaign.status = 'Settled';
        break;
      }
      default:
        break;
    }
  }

  const totalCampaigns = campaigns.size;
  const targetAmounts = [...campaigns.values()]
    .map((c) => c.targetAmount)
    .filter((amount): amount is number => amount != null);
  const averageCampaignSize =
    targetAmounts.length > 0
      ? targetAmounts.reduce((sum, amount) => sum + amount, 0) /
        targetAmounts.length
      : 0;

  const reachedTarget = [...campaigns.values()].filter((c) =>
    TARGET_REACHED_STATUSES.has(c.status),
  ).length;
  const failed = [...campaigns.values()].filter(
    (c) => c.status === 'Failed',
  ).length;
  const stillRaising = totalCampaigns - reachedTarget - failed;
  const fundingSuccessRatePercent =
    totalCampaigns > 0 ? (reachedTarget / totalCampaigns) * 100 : 0;

  const statusCounts = new Map<CampaignStatus, number>();
  for (const status of CAMPAIGN_STATUSES) statusCounts.set(status, 0);
  for (const campaign of campaigns.values()) {
    statusCounts.set(
      campaign.status,
      (statusCounts.get(campaign.status) ?? 0) + 1,
    );
  }

  return {
    totalCampaigns,
    totalVolume,
    averageCampaignSize,
    fundingSuccessRatePercent,
    fundingVolumeOverTime: [...volumeByDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, amount]) => ({ date, amount })),
    campaignsByStatus: CAMPAIGN_STATUSES.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    })),
    campaignSizeDistribution: buildSizeDistribution(targetAmounts),
    fundingOutcome: [
      { label: 'Reached target', value: reachedTarget },
      { label: 'Still raising', value: Math.max(stillRaising, 0) },
      { label: 'Failed', value: failed },
    ],
  };
}

/** Buckets campaign target amounts into up to 5 evenly-sized ranges. */
function buildSizeDistribution(amounts: number[]): SizeBucket[] {
  if (amounts.length === 0) return [];

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);

  if (min === max) {
    return [{ label: formatAmount(min), count: amounts.length }];
  }

  const bucketCount = Math.min(5, amounts.length);
  const bucketSize = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, () => 0);

  for (const amount of amounts) {
    const index = Math.min(
      bucketCount - 1,
      Math.floor((amount - min) / bucketSize),
    );
    buckets[index] += 1;
  }

  return buckets.map((count, index) => {
    const rangeStart = min + index * bucketSize;
    const rangeEnd = index === bucketCount - 1 ? max : rangeStart + bucketSize;
    return {
      label: `${formatAmount(rangeStart)}–${formatAmount(rangeEnd)}`,
      count,
    };
  });
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(
    Math.round(value),
  );
}
