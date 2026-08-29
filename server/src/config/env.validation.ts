import * as Joi from 'joi';

/**
 * Validation schema for environment variables. The application fails fast on
 * startup if any required variable is missing or malformed.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
    .default('info'),
  DATABASE_URL: Joi.string().default('file:./dev.db'),
  SOROBAN_RPC_URL: Joi.string()
    .uri()
    .default('https://soroban-testnet.stellar.org'),
  SOROBAN_NETWORK_PASSPHRASE: Joi.string().default(
    'Test SDF Network ; September 2015',
  ),
  PRODUCTION_ESCROW_CONTRACT_ID: Joi.string().allow('').default(''),
  ESCROW_CONTRACT_ID: Joi.string().allow('').default(''),
  EVENT_POLL_INTERVAL_MS: Joi.number().min(1000).default(5000),
  EVENT_RETENTION_DAYS: Joi.number().min(1).max(7).default(7),
  SOROBAN_INDEXER_START_LEDGER: Joi.number().min(1).optional(),
  CORS_ALLOWED_ORIGINS: Joi.string()
    .custom((value: string, helpers) => {
      const origins = value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);

      if (origins.length === 0 || origins.includes('*')) {
        return helpers.error('corsOrigins.invalid');
      }

      return value;
    }, 'explicit CORS origin allowlist')
    .messages({
      'corsOrigins.invalid':
        '"CORS_ALLOWED_ORIGINS" must contain explicit origins and cannot include "*"',
    })
    .required(),
  THROTTLE_TTL_MS: Joi.number().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().min(1).default(100),
  // Shared secret for verifying HS256 tokens on private WebSocket channels.
  // Optional: when unset, private channels are disabled (fail closed) while
  // public campaign/activity streams stay open. Required to be reasonably
  // strong when provided.
  WS_AUTH_SECRET: Joi.string().min(16).allow('').default(''),
});
