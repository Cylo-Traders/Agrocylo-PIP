import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

/**
 * Exposes the `/health` endpoint used by orchestrators and uptime monitors to
 * determine whether the service is alive and ready to serve traffic.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    // Threshold has headroom above a bare ts-jest/Nest test process's own
    // baseline heap (~270MB before the app does anything), so this check
    // stays meaningful in prod without flaking in CI.
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }
}
