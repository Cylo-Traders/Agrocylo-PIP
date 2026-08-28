import { createHmac } from 'crypto';
import {
  extractTokenFromHandshake,
  verifyWsToken,
  WsTokenError,
} from './ws-auth';

const SECRET = 'test-ws-secret-at-least-16-chars';

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sign(
  payload: Record<string, unknown>,
  secret = SECRET,
  alg = 'HS256',
): string {
  const header = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = b64url(
    createHmac('sha256', secret).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${signature}`;
}

describe('verifyWsToken', () => {
  it('accepts a well-formed token and extracts sub + scopes', () => {
    const token = sign({ sub: 'GABC', scopes: ['notifications:read'] });
    expect(verifyWsToken(token, SECRET)).toEqual({
      sub: 'GABC',
      scopes: ['notifications:read'],
      exp: undefined,
    });
  });

  it('accepts a space-delimited scope string', () => {
    const token = sign({ sub: 'GABC', scope: 'a b c' });
    expect(verifyWsToken(token, SECRET).scopes).toEqual(['a', 'b', 'c']);
  });

  it('rejects a token signed with the wrong secret', () => {
    const token = sign({ sub: 'GABC' }, 'a-completely-different-secret');
    expect(() => verifyWsToken(token, SECRET)).toThrow(WsTokenError);
  });

  it('rejects a tampered payload', () => {
    const token = sign({ sub: 'GABC', scopes: [] });
    const [h, , s] = token.split('.');
    const forged = `${h}.${b64url(JSON.stringify({ sub: 'GEVIL', scopes: ['admin'] }))}.${s}`;
    expect(() => verifyWsToken(forged, SECRET)).toThrow(/signature/);
  });

  it('rejects an expired token', () => {
    const token = sign({ sub: 'GABC', exp: Math.floor(Date.now() / 1000) - 1 });
    expect(() => verifyWsToken(token, SECRET)).toThrow(/expired/);
  });

  it('rejects a non-HS256 algorithm', () => {
    const token = sign({ sub: 'GABC' }, SECRET, 'none');
    expect(() => verifyWsToken(token, SECRET)).toThrow(/algorithm/);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyWsToken('not-a-jwt', SECRET)).toThrow(/malformed/);
  });

  it('rejects a missing sub claim', () => {
    const token = sign({ scopes: ['notifications:read'] });
    expect(() => verifyWsToken(token, SECRET)).toThrow(/sub/);
  });

  it('fails closed when no secret is configured', () => {
    const token = sign({ sub: 'GABC' });
    expect(() => verifyWsToken(token, '')).toThrow(/not configured/);
  });
});

describe('extractTokenFromHandshake', () => {
  it('reads auth.token, stripping a Bearer prefix', () => {
    expect(
      extractTokenFromHandshake({ auth: { token: 'Bearer abc.def.ghi' } }),
    ).toBe('abc.def.ghi');
  });

  it('falls back to the Authorization header', () => {
    expect(
      extractTokenFromHandshake({ headers: { authorization: 'Bearer xyz' } }),
    ).toBe('xyz');
  });

  it('falls back to the token query param', () => {
    expect(extractTokenFromHandshake({ query: { token: 'qtok' } })).toBe(
      'qtok',
    );
  });

  it('returns undefined when nothing is present', () => {
    expect(extractTokenFromHandshake({})).toBeUndefined();
    expect(extractTokenFromHandshake(undefined)).toBeUndefined();
  });
});
