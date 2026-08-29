import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/**
 * Custom Socket.IO adapter that dynamically applies the application's configured
 * `corsAllowedOrigins` setting to all WebSocket server instances.
 *
 * Enforces origin checking both via Socket.IO CORS configuration and via `allowRequest`
 * to ensure non-browser WebSocket handshake requests from disallowed origins are rejected.
 */
export class CorsSocketIoAdapter extends IoAdapter {
  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): any {
    const configService = this.app.get(ConfigService);
    const allowedOrigins =
      configService.get<string[]>('app.corsAllowedOrigins') ?? [];

    const corsOptions = {
      origin: allowedOrigins,
      credentials: true,
    };

    const serverOptions: Partial<ServerOptions> = {
      ...options,
      cors: corsOptions,
      allowRequest: (req, callback) => {
        const origin = req.headers.origin;
        // Allow requests without Origin header (e.g., non-browser clients)
        // or requests whose Origin is listed in allowedOrigins.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback('Origin not allowed by WebSocket CORS policy', false);
        }
      },
    };

    return super.createIOServer(port, serverOptions);
  }
}
