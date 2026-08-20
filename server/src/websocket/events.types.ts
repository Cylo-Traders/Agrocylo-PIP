/**
 * Message contract for the campaign WebSocket gateway.
 *
 * Kept in sync by hand with client/src/lib/websocket/events.types.ts (the
 * repo has no shared-package/workspace tooling yet, so this is the
 * source-of-truth copy — update both together).
 */

/** Normalized event types broadcast to subscribed rooms. */
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

/** Server -> client event name carrying a CampaignEventPayload. */
export const CAMPAIGN_EVENT = 'campaign:event';

/** Client -> server: join the room for one campaign's updates. */
export const SUBSCRIBE_CAMPAIGN = 'subscribe:campaign';
/** Client -> server: leave a campaign room. */
export const UNSUBSCRIBE_CAMPAIGN = 'unsubscribe:campaign';
/** Client -> server: join the platform-wide activity feed room. */
export const SUBSCRIBE_ACTIVITY = 'subscribe:activity';
/** Client -> server: leave the activity feed room. */
export const UNSUBSCRIBE_ACTIVITY = 'unsubscribe:activity';

export const campaignRoom = (campaignId: string): string =>
  `campaign:${campaignId}`;
export const ACTIVITY_ROOM = 'activity';
