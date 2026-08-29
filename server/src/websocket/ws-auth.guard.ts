import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import {
  extractTokenFromHandshake,
  verifyWsToken,
  WsTokenError,
  type WsAuthClaims,
} from './ws-auth';

export const WS_REQUIRED_SCOPES = 'ws:required-scopes';

/**
 * Marks a `@SubscribeMessage` handler as private: the client must present a
 * valid token whose `scopes` include every scope listed here.
 */
export const RequireWsScopes = (...scopes: string[]): MethodDecorator =>
  SetMetadata(WS_REQUIRED_SCOPES, scopes);

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & { auth?: WsAuthClaims };
}

/**
 * Authorization guard for private WebSocket channels. Validates the handshake
 * token against `WS_AUTH_SECRET`, attaches the verified claims to
 * `client.data.auth`, and enforces any scopes declared with
 * {@link RequireWsScopes}. Rejected attempts raise a `WsException` (delivered
 * to the client as an `exception` event) and are logged with the client id and
 * reason.
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'ws') {
      return true;
    }

    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const secret = this.config.get<string>('ws.authSecret') ?? '';
    const event = context.switchToWs().getData?.() as unknown;

    const requiredScopes =
      this.reflector.getAllAndOverride<string[] | undefined>(
        WS_REQUIRED_SCOPES,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    let claims: WsAuthClaims;
    try {
      const token = extractTokenFromHandshake(client.handshake);
      claims = verifyWsToken(token ?? '', secret);
    } catch (error) {
      const reason =
        error instanceof WsTokenError || error instanceof Error
          ? error.message
          : 'invalid token';
      this.deny(client, reason, event);
    }

    const missing = requiredScopes.filter(
      (scope) => !claims!.scopes.includes(scope),
    );
    if (missing.length > 0) {
      this.deny(
        client,
        `missing required scope(s): ${missing.join(', ')}`,
        event,
        claims!.sub,
      );
    }

    client.data.auth = claims!;
    return true;
  }

  private deny(
    client: Socket,
    reason: string,
    event: unknown,
    sub?: string,
  ): never {
    this.logger.warn(
      {
        clientId: client.id,
        event,
        sub,
        reason,
      },
      'Rejected unauthorized WebSocket subscription',
    );
    throw new WsException(`Unauthorized: ${reason}`);
  }
}
