import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Route Nest's internal logging through Pino.
  app.useLogger(app.get(Logger));

  // ---------- Security hardening (closes #103) ----------

  // 1. CORS — allow frontend origin, configurable via env
  const config = app.get(ConfigService);
  const frontendUrl =
    config.get<string>('app.frontendUrl') ?? 'http://localhost:5173';
  app.enableCors({
    origin: [frontendUrl],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
  });

  // 2. Global browser security headers (CSP, XFO, HSTS, etc.)
  const {
    SecurityHeadersMiddleware,
  } = require('./common/middleware/security-headers.middleware');
  app.use(new SecurityHeadersMiddleware().use.bind(new SecurityHeadersMiddleware()));

  // 3. Global validation pipe — rejects unknown properties, strips extras.
  //    Requires `class-validator` + `class-transformer` in package.json.
  const { ValidationPipe } = require('@nestjs/common');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 4. Rate-limiting (express-rate-limit recommended in production).
  //    Install with: npm i express-rate-limit
  //    Then uncomment:
  //    const rateLimit = require('express-rate-limit');
  //    app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

  // ---------- End security hardening ----------

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Agrocylo PIP backend listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
