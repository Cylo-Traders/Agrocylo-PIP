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
  DATABASE_URL: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .required()
      .invalid('file:./dev.db')
      .pattern(/^(?!file:).+$/, { name: 'non-local URL' })
      .messages({
        'any.required': 'DATABASE_URL is required in production environment',
        'any.invalid':
          'DATABASE_URL cannot use default embedded SQLite file:./dev.db in production',
        'string.pattern.name':
          'DATABASE_URL cannot be a local file: URI in production',
      }),
    otherwise: Joi.string().default('file:./dev.db'),
  }),
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
  CORS_ALLOWED_ORIGINS: Joi.string().required(),
  THROTTLE_TTL_MS: Joi.number().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().min(1).default(100),
});
