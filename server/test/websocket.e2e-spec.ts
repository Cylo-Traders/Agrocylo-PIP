import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/setup-app';
import { RealtimeEventsService } from '../src/websocket/realtime-events.service';
import {
  CAMPAIGN_EVENT,
  SUBSCRIBE_CAMPAIGN,
} from '../src/websocket/events.types';

describe('CampaignEventsGateway (e2e)', () => {
  let app: INestApplication;
  let client: Socket;
  let url: string;
  const ALLOWED_ORIGIN = 'http://localhost:5173';
  const DISALLOWED_ORIGIN = 'http://evil.example.com';
  const previousCors = process.env.CORS_ALLOWED_ORIGINS;

  beforeAll(async () => {
    process.env.CORS_ALLOWED_ORIGINS = ALLOWED_ORIGIN;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0);
    const address = app.getHttpServer().address();
    url = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
    process.env.CORS_ALLOWED_ORIGINS = previousCors;
  });

  afterEach(() => {
    client?.close();
  });

  it('connects from an allowed origin, joins a campaign room, and receives a broadcast event', (done) => {
    client = io(url, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: { Origin: ALLOWED_ORIGIN },
    });

    client.on('connect', () => {
      client.emit(SUBSCRIBE_CAMPAIGN, '123');

      // Give the join a tick to land before the "persist" fires.
      setTimeout(() => {
        const realtimeEvents = app.get(RealtimeEventsService);
        realtimeEvents.emitCampaignEvent({
          type: 'campaign.invested',
          campaignId: '123',
          data: { amount: '250' },
        });
      }, 50);
    });

    client.on(CAMPAIGN_EVENT, (payload) => {
      expect(payload).toEqual({
        type: 'campaign.invested',
        campaignId: '123',
        data: { amount: '250' },
      });
      done();
    });
  }, 10000);

  it('rejects a WebSocket handshake from a disallowed origin', async () => {
    const unauthorizedClient = io(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 2000,
      extraHeaders: { Origin: DISALLOWED_ORIGIN },
    });

    try {
      const result = await new Promise<'connected' | 'rejected'>((resolve) => {
        unauthorizedClient.once('connect', () => resolve('connected'));
        unauthorizedClient.once('connect_error', () => resolve('rejected'));
      });

      expect(result).toBe('rejected');
    } finally {
      unauthorizedClient.close();
    }
  });

  it('does not deliver events for rooms the client never joined', (done) => {
    client = io(url, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: { Origin: ALLOWED_ORIGIN },
    });
    const received: unknown[] = [];

    client.on('connect', () => {
      // Deliberately not subscribing to any room.
      const realtimeEvents = app.get(RealtimeEventsService);
      realtimeEvents.emitCampaignEvent({
        type: 'campaign.funded',
        campaignId: '999',
        data: {},
      });

      setTimeout(() => {
        expect(received).toHaveLength(0);
        done();
      }, 200);
    });

    client.on(CAMPAIGN_EVENT, (payload) => received.push(payload));
  }, 10000);

  it('accepts a connection from an allowed origin', (done) => {
    client = io(url, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: { Origin: ALLOWED_ORIGIN },
    });

    client.on('connect', () => {
      expect(client.connected).toBe(true);
      done();
    });

    client.on('connect_error', (err) => {
      done(err);
    });
  }, 10000);

  it('rejects a connection from a disallowed origin', (done) => {
    client = io(url, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: { Origin: DISALLOWED_ORIGIN },
    });

    client.on('connect', () => {
      done(new Error('Connection from disallowed origin should have failed'));
    });

    client.on('connect_error', (err) => {
      expect(err).toBeDefined();
      done();
    });
  }, 10000);
});
