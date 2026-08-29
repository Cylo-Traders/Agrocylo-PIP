import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Claims carried by a verified WebSocket auth token, attached to
 * `client.data.auth` once {@link WsAuthGuard} accepts a connection.
 */
export interface WsAuthClaims {
  /** Stable identifier for the authenticated principal (e.g. wallet address). */
  sub: string;
  /** Granted scopes, used to gate access to specific private channels. */
  scopes: string[];
  /** Unix seconds; the token is rejected once this passes. */
  exp?: number;
}

export class WsTokenError extends Error {}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

/**
 * Verifies a compact HS256 JWT with a shared secret, with no external
 * dependency. Deliberately minimal: the platform only needs symmetric
 * signature + expiry + claim extraction, not the full JWA/JWE surface.
 *
 * Token format (documented in `.env.example` / server README):
 *   header  = { "alg": "HS256", "typ": "JWT" }
 *   payload = { "sub": "<principal>", "scopes": ["notifications:read"], "exp": <unix-seconds> }
 *   signature = HMAC-SHA256(base64url(header) + "." + base64url(payload), WS_AUTH_SECRET)
 *
 * A space-delimited `scope` string is also accepted in place of `scopes`.
 */
export function verifyWsToken(token: string, secret: string): WsAuthClaims {
  if (!secret) {
    throw new WsTokenError('WebSocket authentication is not configured');
  }
  if (!token) {
    throw new WsTokenError('missing token');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new WsTokenError('malformed token');
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
  } catch {
    throw new WsTokenError('malformed token header');
  }
  if (header.alg !== 'HS256') {
    throw new WsTokenError('unsupported token algorithm');
  }

  const expected = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const provided = base64UrlDecode(signatureB64);
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    throw new WsTokenError('invalid token signature');
  }

  let payload: {
    sub?: unknown;
    exp?: unknown;
    scopes?: unknown;
    scope?: unknown;
  };
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    throw new WsTokenError('malformed token payload');
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new WsTokenError('token is missing the "sub" claim');
  }
  if (typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000) {
    throw new WsTokenError('token has expired');
  }

  const scopes = Array.isArray(payload.scopes)
    ? payload.scopes.filter((s): s is string => typeof s === 'string')
    : typeof payload.scope === 'string'
      ? payload.scope.split(' ').filter((s) => s.length > 0)
      : [];

  return {
    sub: payload.sub,
    scopes,
    exp: typeof payload.exp === 'number' ? payload.exp : undefined,
  };
}

interface HandshakeLike {
  auth?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

/**
 * Pulls the bearer token from a Socket.IO handshake, checking (in order) the
 * `auth.token` payload, the `Authorization` header, and a `token` query param
 * so browser and non-browser clients can both authenticate.
 */
export function extractTokenFromHandshake(
  handshake: HandshakeLike | undefined,
): string | undefined {
  const strip = (value: string): string => value.replace(/^Bearer\s+/i, '');

  const authToken = handshake?.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) {
    return strip(authToken);
  }

  const authHeader = handshake?.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.length > 0) {
    return strip(authHeader);
  }

  const queryToken = handshake?.query?.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return strip(queryToken);
  }

  return undefined;
}
