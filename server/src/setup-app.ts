import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { CorsSocketIoAdapter } from './websocket/cors-socket-io.adapter';

/**
 * Applies production-hardening middleware/pipes shared by the real bootstrap
 * (main.ts) and e2e tests, which build the Nest application directly via
 * `createNestApplication()` and would otherwise bypass main.ts entirely.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const corsAllowedOrigins =
    config.get<string[]>('app.corsAllowedOrigins') ?? [];

  app.use(helmet());

  app.enableCors({
    origin: corsAllowedOrigins,
    credentials: true,
  });

  app.useWebSocketAdapter(new CorsSocketIoAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
