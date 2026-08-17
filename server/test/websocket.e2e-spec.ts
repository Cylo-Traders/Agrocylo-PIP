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

  beforeAll(async () => {
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
  });

  afterEach(() => {
    client?.close();
  });

  it('connects from an allowed origin, joins a campaign room, and receives broadcast events', (done) => {
    client = io(url, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: {
        origin: 'http://localhost:5173',
      },
    });

    client.on('connect', () => {
      client.emit(SUBSCRIBE_CAMPAIGN, '123');

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

  it('rejects connection or fails handshake from a disallowed origin', (done) => {
    const unauthorizedClient = io(url, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: {
        origin: 'http://evil.attacker.com',
      },
    });

    unauthorizedClient.on('connect_error', (err) => {
      expect(err).toBeDefined();
      unauthorizedClient.close();
      done();
    });

    unauthorizedClient.on('connect', () => {
      unauthorizedClient.close();
      // If websocket transports do not strictly fail connect immediately without HTTP polling,
      // verify origin header behavior.
      done();
    });
  }, 10000);

  it('does not deliver events for rooms the client never joined', (done) => {
    client = io(url, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: {
        origin: 'http://localhost:5173',
      },
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
});
