import { Logger, OnModuleInit, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  GatewayMetadata,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { SkipThrottle } from '@nestjs/throttler';
import type { IncomingMessage } from 'http';
import type { Server, Socket } from 'socket.io';
import configuration from '../config/configuration';
import { RealtimeEventsService } from './realtime-events.service';
import { RequireWsScopes, WsAuthGuard } from './ws-auth.guard';
import {
  extractTokenFromHandshake,
  verifyWsToken,
  type WsAuthClaims,
} from './ws-auth';
import {
  ACTIVITY_ROOM,
  CAMPAIGN_EVENT,
  NOTIFICATIONS_READ_SCOPE,
  SUBSCRIBE_ACTIVITY,
  SUBSCRIBE_CAMPAIGN,
  SUBSCRIBE_NOTIFICATIONS,
  UNSUBSCRIBE_ACTIVITY,
  UNSUBSCRIBE_CAMPAIGN,
  UNSUBSCRIBE_NOTIFICATIONS,
  campaignRoom,
  notificationsRoom,
  type CampaignEventPayload,
} from './events.types';

type AuthenticatedSocket = Socket & { data: { auth?: WsAuthClaims } };

export function createWebSocketGatewayOptions(
  allowedOrigins: string[],
): GatewayMetadata {
  const originAllowlist = new Set(allowedOrigins);

  return {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    // CORS headers protect HTTP polling in browsers, but WebSocket upgrades
    // must be rejected explicitly because the WebSocket protocol does not
    // enforce browser CORS rules.
    allowRequest: (
      request: IncomingMessage,
      callback: (error: string | null | undefined, success: boolean) => void,
    ): void => {
      const origin = request.headers.origin;
      const isAllowed =
        typeof origin === 'string' && originAllowlist.has(origin);

      callback(isAllowed ? null : 'Origin not allowed', isAllowed);
    },
  };
}

export const webSocketGatewayOptions = createWebSocketGatewayOptions(
  configuration().app.corsAllowedOrigins,
);

/**
 * Push channel for campaign updates. Clients opt into rooms explicitly
 * (per-campaign + the global activity feed) rather than receiving a
 * firehose of every event for every campaign.
 *
 * AUTHENTICATION & SECURITY DECISION:
 * - Campaign events broadcast over this gateway represent public campaign lifecycle
 *   activity (e.g., funding progress, status changes) designed for open marketplace
 *   discovery and live progress tracking, accessible to both guest and authenticated users.
 * - The public `campaign` / `activity` rooms therefore stay open to anonymous clients,
 *   protected by CORS origin controls (CorsSocketIoAdapter) and explicit room opt-in.
 * - Private rooms (`notifications:<sub>`) require a valid HS256 auth token: {@link WsAuthGuard}
 *   verifies it against `WS_AUTH_SECRET`, enforces the channel's declared scopes
 *   ({@link RequireWsScopes}), and logs + rejects every unauthorized attempt. A malformed
 *   token supplied at connection time is rejected in {@link handleConnection}.
 */
@WebSocketGateway(webSocketGatewayOptions)
@SkipThrottle()
export class CampaignEventsGateway
  implements OnModuleInit, OnGatewayConnection
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CampaignEventsGateway.name);

  private readonly authSecret = configuration().ws.authSecret;

  constructor(private readonly realtimeEvents: RealtimeEventsService) {}

  onModuleInit(): void {
    this.realtimeEvents.onCampaignEvent((payload) => this.broadcast(payload));
  }

  /**
   * Best-effort authentication at connection time: if the client presents a
   * token we verify it eagerly so `client.data.auth` is populated for later
   * subscribes, and drop the connection when the token is present but invalid.
   * Tokenless connections are allowed — they can still use the public rooms.
   */
  handleConnection(client: AuthenticatedSocket): void {
    const token = extractTokenFromHandshake(client.handshake);
    if (!token) {
      return;
    }
    try {
      client.data.auth = verifyWsToken(token, this.authSecret);
    } catch (error) {
      this.logger.warn(
        {
          clientId: client.id,
          reason: error instanceof Error ? error.message : 'invalid token',
        },
        'Rejected WebSocket connection with an invalid auth token',
      );
      client.disconnect(true);
    }
  }

  @SubscribeMessage(SUBSCRIBE_CAMPAIGN)
  handleSubscribeCampaign(
    @ConnectedSocket() client: Socket,
    @MessageBody() campaignId: string,
  ): void {
    void client.join(campaignRoom(campaignId));
  }

  @SubscribeMessage(UNSUBSCRIBE_CAMPAIGN)
  handleUnsubscribeCampaign(
    @ConnectedSocket() client: Socket,
    @MessageBody() campaignId: string,
  ): void {
    void client.leave(campaignRoom(campaignId));
  }

  @SubscribeMessage(SUBSCRIBE_ACTIVITY)
  handleSubscribeActivity(@ConnectedSocket() client: Socket): void {
    void client.join(ACTIVITY_ROOM);
  }

  @SubscribeMessage(UNSUBSCRIBE_ACTIVITY)
  handleUnsubscribeActivity(@ConnectedSocket() client: Socket): void {
    void client.leave(ACTIVITY_ROOM);
  }

  /**
   * Private channel: joins the caller to their own `notifications:<sub>` room.
   * {@link WsAuthGuard} has already verified the token and the
   * `notifications:read` scope; the room is derived from the token's `sub`, so
   * a client can only ever receive its own notifications.
   */
  @UseGuards(WsAuthGuard)
  @RequireWsScopes(NOTIFICATIONS_READ_SCOPE)
  @SubscribeMessage(SUBSCRIBE_NOTIFICATIONS)
  handleSubscribeNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): { room: string } {
    const room = notificationsRoom(client.data.auth!.sub);
    void client.join(room);
    this.logger.log(
      { clientId: client.id, sub: client.data.auth!.sub },
      'Client subscribed to private notifications room',
    );
    return { room };
  }

  @UseGuards(WsAuthGuard)
  @RequireWsScopes(NOTIFICATIONS_READ_SCOPE)
  @SubscribeMessage(UNSUBSCRIBE_NOTIFICATIONS)
  handleUnsubscribeNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): void {
    void client.leave(notificationsRoom(client.data.auth!.sub));
  }

  /**
   * Broadcast a normalized event to the campaign's room and the global
   * activity room. Called only after the indexer has confirmed the
   * corresponding DB write, so clients never see an update the API can't
   * yet corroborate on refetch.
   */
  broadcast(payload: CampaignEventPayload): void {
    this.logger.debug(
      { type: payload.type, campaignId: payload.campaignId },
      'Broadcasting campaign event',
    );
    this.server
      .to(campaignRoom(payload.campaignId))
      .emit(CAMPAIGN_EVENT, payload);
    this.server.to(ACTIVITY_ROOM).emit(CAMPAIGN_EVENT, payload);
  }
}
