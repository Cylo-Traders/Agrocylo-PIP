/**
 * Strongly typed application configuration loaded from environment variables.
 * Consumed via `ConfigService` throughout the application.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
}

export interface DatabaseConfig {
  url: string;
  connectOnStartup: boolean;
}

export interface SorobanConfig {
  enabled: boolean;
  rpcUrl: string;
  networkPassphrase: string;
  productionEscrowContractId: string;
  escrowContractId: string;
  eventPollIntervalMs: number;
  eventRetentionDays: number;
}

const defaultDatabaseUrl =
  'postgresql://postgres:postgres@localhost:5432/agrocylo_pip?schema=public';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

export default (): {
  app: AppConfig;
  database: DatabaseConfig;
  soroban: SorobanConfig;
} => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
    app: {
      nodeEnv,
      port: parseInt(process.env.PORT ?? '3000', 10),
      logLevel: process.env.LOG_LEVEL ?? 'info',
    },
    database: {
      url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
      connectOnStartup: parseBoolean(
        process.env.DATABASE_CONNECT_ON_STARTUP,
        nodeEnv !== 'test',
      ),
    },
    soroban: {
      enabled: parseBoolean(process.env.INDEXER_ENABLED, nodeEnv !== 'test'),
      rpcUrl:
        process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
      networkPassphrase:
        process.env.SOROBAN_NETWORK_PASSPHRASE ??
        'Test SDF Network ; September 2015',
      productionEscrowContractId:
        process.env.PRODUCTION_ESCROW_CONTRACT_ID ?? '',
      escrowContractId: process.env.ESCROW_CONTRACT_ID ?? '',
      eventPollIntervalMs: parseInt(
        process.env.EVENT_POLL_INTERVAL_MS ?? '5000',
        10,
      ),
      eventRetentionDays: parseInt(process.env.EVENT_RETENTION_DAYS ?? '7', 10),
    },
  };
};
