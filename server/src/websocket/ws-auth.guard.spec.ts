import { createHmac } from 'crypto';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import {
  RequireWsScopes,
  WsAuthGuard,
  WS_REQUIRED_SCOPES,
} from './ws-auth.guard';

const SECRET = 'guard-ws-secret-at-least-16';

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sign(payload: Record<string, unknown>, secret = SECRET): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = b64url(
    createHmac('sha256', secret).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${signature}`;
}

function context(client: any, data: unknown, requiredScopes?: string[]) {
  const handler = () => undefined;
  if (requiredScopes) {
    Reflect.defineMetadata(WS_REQUIRED_SCOPES, requiredScopes, handler);
  }
  return {
    getType: () => 'ws',
    getHandler: () => handler,
    getClass: () => class {},
    switchToWs: () => ({
      getClient: () => client,
      getData: () => data,
    }),
  } as any;
}

describe('WsAuthGuard', () => {
  let guard: WsAuthGuard;

  beforeEach(() => {
    const config = {
      get: jest.fn().mockReturnValue(SECRET),
    } as unknown as ConfigService;
    guard = new WsAuthGuard(new Reflector(), config);
    jest.spyOn(guard['logger'], 'warn').mockImplementation(() => undefined);
  });

  it('passes non-ws contexts straight through', () => {
    const ctx = { getType: () => 'http' } as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('accepts a valid token with the required scope and attaches claims', () => {
    const client = {
      id: 'c1',
      data: {},
      handshake: {
        auth: { token: sign({ sub: 'GABC', scopes: ['notifications:read'] }) },
      },
    };
    const ctx = context(client, 'subscribe:notifications', [
      'notifications:read',
    ]);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(client.data).toMatchObject({ auth: { sub: 'GABC' } });
  });

  it('rejects and logs a missing token', () => {
    const client = { id: 'c2', data: {}, handshake: { auth: {} } };
    const ctx = context(client, 'subscribe:notifications', [
      'notifications:read',
    ]);

    expect(() => guard.canActivate(ctx)).toThrow(WsException);
    expect(guard['logger'].warn).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'c2', reason: expect.any(String) }),
      expect.stringContaining('Rejected unauthorized'),
    );
  });

  it('rejects a valid token that lacks the required scope', () => {
    const client = {
      id: 'c3',
      data: {},
      handshake: { auth: { token: sign({ sub: 'GABC', scopes: ['other'] }) } },
    };
    const ctx = context(client, 'subscribe:notifications', [
      'notifications:read',
    ]);

    expect(() => guard.canActivate(ctx)).toThrow(/missing required scope/);
  });

  it('rejects a token signed with the wrong secret', () => {
    const client = {
      id: 'c4',
      data: {},
      handshake: {
        auth: { token: sign({ sub: 'GABC' }, 'wrong-secret-value') },
      },
    };
    const ctx = context(client, 'subscribe:notifications', [
      'notifications:read',
    ]);

    expect(() => guard.canActivate(ctx)).toThrow(WsException);
  });

  it('RequireWsScopes decorator records scope metadata', () => {
    class Sample {
      @RequireWsScopes('a', 'b')
      handler(): void {}
    }
    const scopes = Reflect.getMetadata(
      WS_REQUIRED_SCOPES,
      Sample.prototype.handler,
    );
    expect(scopes).toEqual(['a', 'b']);
  });
});
