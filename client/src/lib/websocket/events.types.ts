/**
 * Message contract for the campaign WebSocket gateway.
 *
 * Kept in sync by hand with server/src/websocket/events.types.ts (the repo
 * has no shared-package/workspace tooling yet, so this is a mirror — update
 * both together).
 */

export type CampaignEventType =
  | 'campaign.escrow_created'
  | 'campaign.invested'
  | 'campaign.contrib_reconciled'
  | 'campaign.funded'
  | 'campaign.tranches_configured'
  | 'campaign.tranche_released'
  | 'campaign.harvest_reported'
  | 'campaign.failed'
  | 'campaign.return_claimed'
  | 'campaign.refund_claimed'
  | 'campaign.dispute_opened'
  | 'campaign.dispute_resolved'
  | 'campaign.settled'
  | 'campaign.created'
  | 'campaign.escrow_linked'
  | 'campaign.status_updated';

export interface CampaignEventPayload {
  type: CampaignEventType;
  campaignId: string;
  data: Record<string, unknown>;
}

export const CAMPAIGN_EVENT = 'campaign:event';
export const SUBSCRIBE_CAMPAIGN = 'subscribe:campaign';
export const UNSUBSCRIBE_CAMPAIGN = 'unsubscribe:campaign';
export const SUBSCRIBE_ACTIVITY = 'subscribe:activity';
export const UNSUBSCRIBE_ACTIVITY = 'unsubscribe:activity';
