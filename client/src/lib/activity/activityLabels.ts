import type { ActivityActionTag } from '../soroban/types';

export interface ActivityActionMeta {
  label: string;
  icon: string;
  colorClass: string;
}

export const ACTIVITY_ACTION_META: Record<
  ActivityActionTag,
  ActivityActionMeta
> = {
  CampaignCreated: {
    label: 'Campaign created',
    icon: '🌱',
    colorClass: 'activity-tag--created',
  },
  CampaignFunded: {
    label: 'Campaign funded',
    icon: '💰',
    colorClass: 'activity-tag--funded',
  },
  CampaignStatusChanged: {
    label: 'Status changed',
    icon: '🔄',
    colorClass: 'activity-tag--status',
  },
  FundsReleased: {
    label: 'Funds released',
    icon: '🏦',
    colorClass: 'activity-tag--released',
  },
  HarvestReported: {
    label: 'Harvest reported',
    icon: '🌾',
    colorClass: 'activity-tag--harvest',
  },
  DisputeInitiated: {
    label: 'Dispute initiated',
    icon: '⚠️',
    colorClass: 'activity-tag--dispute',
  },
  DisputeResolved: {
    label: 'Dispute resolved',
    icon: '✅',
    colorClass: 'activity-tag--resolved',
  },
  CampaignSettled: {
    label: 'Campaign settled',
    icon: '🎯',
    colorClass: 'activity-tag--settled',
  },
  FarmerRegistered: {
    label: 'Farmer registered',
    icon: '👤',
    colorClass: 'activity-tag--farmer',
  },
  CampaignRegistered: {
    label: 'Campaign registered',
    icon: '📋',
    colorClass: 'activity-tag--registered',
  },
};

export function getActivityMeta(tag: ActivityActionTag): ActivityActionMeta {
  return ACTIVITY_ACTION_META[tag] ?? { label: tag, icon: '•', colorClass: '' };
}

/** Returns a human-readable sentence for a given action + actor pair. */
export function formatActivityLine(
  tag: ActivityActionTag,
  actor: string,
  campaignId?: bigint,
): string {
  const short = `${actor.slice(0, 6)}…${actor.slice(-4)}`;
  const camp = campaignId !== undefined ? ` on Campaign #${campaignId}` : '';

  switch (tag) {
    case 'CampaignCreated':
      return `${short} created a new campaign${camp}`;
    case 'CampaignFunded':
      return `${short} funded campaign${camp}`;
    case 'CampaignStatusChanged':
      return `Status updated${camp} by ${short}`;
    case 'FundsReleased':
      return `Funds released${camp} to ${short}`;
    case 'HarvestReported':
      return `${short} reported harvest${camp}`;
    case 'DisputeInitiated':
      return `${short} opened a dispute${camp}`;
    case 'DisputeResolved':
      return `Dispute resolved${camp} by ${short}`;
    case 'CampaignSettled':
      return `Campaign settled${camp} by ${short}`;
    case 'FarmerRegistered':
      return `Farmer ${short} registered on the platform`;
    case 'CampaignRegistered':
      return `Campaign${camp} registered in the registry`;
    default:
      return `Activity by ${short}${camp}`;
  }
}
