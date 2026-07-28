/**
 * Strongly typed application configuration loaded from environment variables.
 * Consumed via `ConfigService` throughout the application.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
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

export default (): {
  app: AppConfig;
  db: DbConfig;
  soroban: SorobanConfig;
} => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  },
  db: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
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
});
