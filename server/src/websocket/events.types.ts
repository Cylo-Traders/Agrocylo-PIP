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

/**
 * Client -> server: join the caller's private notification room. Requires a
 * valid auth token (see server README / `.env.example`) whose `scopes`
 * include `notifications:read`; the room is always the token's own `sub`, so
 * one principal cannot subscribe to another's stream.
 */
export const SUBSCRIBE_NOTIFICATIONS = 'subscribe:notifications';
/** Client -> server: leave the private notification room. */
export const UNSUBSCRIBE_NOTIFICATIONS = 'unsubscribe:notifications';
/** Scope required to subscribe to a private notification room. */
export const NOTIFICATIONS_READ_SCOPE = 'notifications:read';

export const campaignRoom = (campaignId: string): string =>
  `campaign:${campaignId}`;
export const ACTIVITY_ROOM = 'activity';
export const notificationsRoom = (subject: string): string =>
  `notifications:${subject}`;
