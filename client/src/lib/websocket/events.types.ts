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

/**
 * Private channel: the caller's own notification stream. Requires an auth
 * token on the Socket.IO handshake:
 *
 *   io(url, { auth: { token: `Bearer ${jwt}` } })
 *
 * The JWT is HS256, signed with the server's `WS_AUTH_SECRET`, payload
 * `{ sub, scopes: ['notifications:read'], exp }`. Unauthorized subscribes
 * come back as a Socket.IO `exception` event and never join the room.
 */
export const SUBSCRIBE_NOTIFICATIONS = 'subscribe:notifications';
export const UNSUBSCRIBE_NOTIFICATIONS = 'unsubscribe:notifications';
export const NOTIFICATIONS_READ_SCOPE = 'notifications:read';
