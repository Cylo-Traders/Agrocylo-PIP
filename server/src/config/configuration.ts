/**
 * Strongly typed application configuration loaded from environment variables.
 * Consumed via `ConfigService` throughout the application.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  corsAllowedOrigins: string[];
}

export interface WsConfig {
  /**
   * Shared secret used to verify HS256 auth tokens on private WebSocket
   * channels. Empty string means private channels are disabled (fail closed);
   * public campaign/activity streams stay open regardless.
   */
  authSecret: string;
}

export interface ThrottleConfig {
  ttlMs: number;
  limit: number;
}

export interface DbConfig {
  url: string;
}

export interface SorobanConfig {
  rpcUrl: string;
  networkPassphrase: string;
  productionEscrowContractId: string;
  escrowContractId: string;
  eventPollIntervalMs: number;
  eventRetentionDays: number;
  /** Ledger to start indexing from when no persisted cursor exists yet. */
  indexerStartLedger?: number;
}

function validateDatabaseUrl(nodeEnv: string, databaseUrl: string | undefined): string {
  const url = databaseUrl ?? 'file:./dev.db';
  if (nodeEnv === 'production' && url.startsWith('file:')) {
    throw new Error(
      'DATABASE_URL cannot be a local SQLite file (file:...) in production. ' +
        'Set a real database URI (e.g. postgresql://user:pass@host/db) before starting the app.',
    );
  }
  return url;
}

export default (): {
  app: AppConfig;
  ws: WsConfig;
  db: DbConfig;
  soroban: SorobanConfig;
  throttle: ThrottleConfig;
} => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return {
    app: {
      nodeEnv,
      port: parseInt(process.env.PORT ?? '3000', 10),
      logLevel: process.env.LOG_LEVEL ?? 'info',
      corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    },
    ws: {
      authSecret: process.env.WS_AUTH_SECRET ?? '',
    },
    db: {
      url: validateDatabaseUrl(nodeEnv, process.env.DATABASE_URL),
    },
    soroban: {
      rpcUrl:
        process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
      networkPassphrase:
        process.env.SOROBAN_NETWORK_PASSPHRASE ??
        'Test SDF Network ; September 2015',
      productionEscrowContractId: process.env.PRODUCTION_ESCROW_CONTRACT_ID ?? '',
      escrowContractId: process.env.ESCROW_CONTRACT_ID ?? '',
      eventPollIntervalMs: parseInt(
        process.env.EVENT_POLL_INTERVAL_MS ?? '5000',
        10,
      ),
      eventRetentionDays: parseInt(process.env.EVENT_RETENTION_DAYS ?? '7', 10),
      indexerStartLedger: process.env.SOROBAN_INDEXER_START_LEDGER
        ? parseInt(process.env.SOROBAN_INDEXER_START_LEDGER, 10)
        : undefined,
    },
    throttle: {
      ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    },
  };
};
