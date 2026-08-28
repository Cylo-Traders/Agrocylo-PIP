import { createHmac } from 'crypto';
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants';
import {
  CampaignEventsGateway,
  createWebSocketGatewayOptions,
  webSocketGatewayOptions,
} from './campaign-events.gateway';
import configuration from '../config/configuration';
import { RealtimeEventsService } from './realtime-events.service';
import { ACTIVITY_ROOM, campaignRoom, notificationsRoom } from './events.types';

const WS_SECRET = 'gateway-ws-secret-at-least-16';

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signToken(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = b64url(
    createHmac('sha256', WS_SECRET).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${signature}`;
}

function mockSocket() {
  return { join: jest.fn(), leave: jest.fn() } as any;
}

describe('CampaignEventsGateway', () => {
  let gateway: CampaignEventsGateway;
  let realtime: RealtimeEventsService;
  let emit: jest.Mock;
  let to: jest.Mock;

  beforeEach(() => {
    realtime = new RealtimeEventsService();
    gateway = new CampaignEventsGateway(realtime);
    emit = jest.fn();
    to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to } as any;
  });

  describe('origin allowlist', () => {
    const allowedOrigin = 'https://app.agrocylo.example';

    it('configures the gateway without a wildcard origin', () => {
      const gatewayOptions = Reflect.getMetadata(
        GATEWAY_OPTIONS,
        CampaignEventsGateway,
      );

      expect(gatewayOptions).toBeDefined();
      expect(gatewayOptions.cors.origin).toEqual(
        configuration().app.corsAllowedOrigins,
      );
      expect(gatewayOptions).toEqual(webSocketGatewayOptions);
      expect(gatewayOptions.cors.origin).not.toContain('*');
      expect(gatewayOptions.allowRequest).toEqual(expect.any(Function));
    });

    it('allows a handshake from a configured origin', () => {
      const options = createWebSocketGatewayOptions([allowedOrigin]);
      const callback = jest.fn();

      options.allowRequest?.({ headers: { origin: allowedOrigin } }, callback);

      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it.each([undefined, 'https://evil.example'])(
      'rejects a handshake from origin %s',
      (origin) => {
        const options = createWebSocketGatewayOptions([allowedOrigin]);
        const callback = jest.fn();

        options.allowRequest?.({ headers: { origin } }, callback);

        expect(callback).toHaveBeenCalledWith('Origin not allowed', false);
      },
    );
  });

  it('joins a client to a campaign room on subscribe', () => {
    const client = mockSocket();
    gateway.handleSubscribeCampaign(client, '123');
    expect(client.join).toHaveBeenCalledWith(campaignRoom('123'));
  });

  it('removes a client from a campaign room on unsubscribe', () => {
    const client = mockSocket();
    gateway.handleUnsubscribeCampaign(client, '123');
    expect(client.leave).toHaveBeenCalledWith(campaignRoom('123'));
  });

  it('joins and leaves the global activity room', () => {
    const client = mockSocket();
    gateway.handleSubscribeActivity(client);
    expect(client.join).toHaveBeenCalledWith(ACTIVITY_ROOM);
    gateway.handleUnsubscribeActivity(client);
    expect(client.leave).toHaveBeenCalledWith(ACTIVITY_ROOM);
  });

  it('broadcasts to the campaign room and the activity room', () => {
    const payload = {
      type: 'campaign.invested' as const,
      campaignId: '123',
      data: { amount: '250' },
    };
    gateway.broadcast(payload);

    expect(to).toHaveBeenCalledWith(campaignRoom('123'));
    expect(to).toHaveBeenCalledWith(ACTIVITY_ROOM);
    expect(emit).toHaveBeenCalledWith('campaign:event', payload);
  });

  it('broadcasts automatically when the realtime service emits a campaign event (broadcast-after-persist wiring)', () => {
    gateway.onModuleInit();
    const payload = {
      type: 'campaign.funded' as const,
      campaignId: '456',
      data: {},
    };

    realtime.emitCampaignEvent(payload);

    expect(to).toHaveBeenCalledWith(campaignRoom('456'));
    expect(emit).toHaveBeenCalledWith('campaign:event', payload);
  });

  describe('private notifications channel', () => {
    let authedGateway: CampaignEventsGateway;
    let originalSecret: string | undefined;

    beforeEach(() => {
      originalSecret = process.env.WS_AUTH_SECRET;
      process.env.WS_AUTH_SECRET = WS_SECRET;
      authedGateway = new CampaignEventsGateway(new RealtimeEventsService());
    });

    afterEach(() => {
      if (originalSecret === undefined) {
        delete process.env.WS_AUTH_SECRET;
      } else {
        process.env.WS_AUTH_SECRET = originalSecret;
      }
    });

    it('joins the caller to their own notifications room (guard already verified the token)', () => {
      const client = {
        id: 'c1',
        data: { auth: { sub: 'GABC', scopes: ['notifications:read'] } },
        join: jest.fn(),
      } as any;

      const result = authedGateway.handleSubscribeNotifications(client);

      expect(client.join).toHaveBeenCalledWith(notificationsRoom('GABC'));
      expect(result).toEqual({ room: notificationsRoom('GABC') });
    });

    it('leaves only the caller-scoped notifications room', () => {
      const client = {
        id: 'c1',
        data: { auth: { sub: 'GABC', scopes: ['notifications:read'] } },
        leave: jest.fn(),
      } as any;

      authedGateway.handleUnsubscribeNotifications(client);

      expect(client.leave).toHaveBeenCalledWith(notificationsRoom('GABC'));
    });

    it('accepts a connection carrying a valid token and caches the claims', () => {
      const client = {
        id: 'c2',
        data: {} as Record<string, unknown>,
        handshake: {
          auth: { token: signToken({ sub: 'GXYZ', scopes: [] }) },
        },
        disconnect: jest.fn(),
      } as any;

      authedGateway.handleConnection(client);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.auth).toMatchObject({ sub: 'GXYZ' });
    });

    it('drops a connection whose token is present but invalid', () => {
      const warn = jest
        .spyOn(authedGateway['logger'], 'warn')
        .mockImplementation(() => undefined);
      const client = {
        id: 'c3',
        data: {} as Record<string, unknown>,
        handshake: { auth: { token: 'garbage.token.value' } },
        disconnect: jest.fn(),
      } as any;

      authedGateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(warn).toHaveBeenCalled();
    });

    it('leaves tokenless connections untouched (public rooms still usable)', () => {
      const client = {
        id: 'c4',
        data: {} as Record<string, unknown>,
        handshake: { auth: {} },
        disconnect: jest.fn(),
      } as any;

      authedGateway.handleConnection(client);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.auth).toBeUndefined();
    });
  });
});
