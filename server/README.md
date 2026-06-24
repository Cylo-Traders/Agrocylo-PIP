# Agrocylo PIP - Backend Service

Backend service for the **Agrocylo Production Investment Platform**. Built with
[NestJS](https://nestjs.com/) and TypeScript using a modular, scalable
architecture so that indexing, APIs, analytics, and real-time features can grow
independently.

## Tech Stack

- **Runtime:** Node.js (>= 18)
- **Framework:** NestJS 10
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Logging:** Pino (via `nestjs-pino`)
- **Config & validation:** `@nestjs/config` + Joi
- **Health checks:** `@nestjs/terminus`

## Project Structure

```text
server/
├── prisma/         # Prisma schema and migrations
├── src/
│   ├── common/     # Cross-cutting concerns (logging, filters, guards)
│   ├── config/     # Environment config loading and validation
│   ├── database/   # Database connection and Prisma service
│   ├── indexer/    # Soroban on-chain event indexing
│   ├── modules/    # Feature modules (e.g. health)
│   ├── app.module.ts
│   └── main.ts
└── test/           # End-to-end tests
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- PostgreSQL-compatible database

### Installation

```bash
cd server
npm install
```

### Environment

Copy the example environment file and adjust values as needed:

```bash
cp .env.example .env
```

| Variable | Description | Default |
| --- | --- | --- |
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | Port the HTTP server listens on | `3000` |
| `LOG_LEVEL` | Pino log level (`trace`...`fatal`) | `info` |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma | Local `agrocylo_pip` DB |
| `DATABASE_CONNECT_ON_STARTUP` | Whether the app opens a DB connection on startup | `true` outside test runs |
| `INDEXER_ENABLED` | Whether the Soroban event listener starts with the app | `true` outside test runs |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint | Stellar testnet RPC |
| `SOROBAN_NETWORK_PASSPHRASE` | Soroban network passphrase | Stellar testnet passphrase |

Environment variables are validated on startup; the server fails fast if any
value is missing or invalid.

### Database Setup

The Prisma schema lives in `prisma/schema.prisma`. The initial migration creates
storage for indexed blockchain events and an indexer cursor.

```bash
# generate the Prisma client
npm run prisma:generate

# create/apply a local migration during development
npm run prisma:migrate

# apply checked-in migrations in production/CI
npm run prisma:deploy
```

For tests that do not start Postgres, set
`DATABASE_CONNECT_ON_STARTUP=false`.

## Running the App

```bash
# development (watch mode)
npm run dev

# production build
npm run build
npm run start:prod
```

## Health Check

Once running, the service exposes a health endpoint:

```bash
curl http://localhost:3000/health
```

Returns `200 OK` with a JSON payload describing service health.

## Testing

```bash
# unit tests
npm test

# end-to-end tests
npm run test:e2e

# coverage
npm run test:cov
```

## Linting & Formatting

```bash
npm run lint
npm run format
```
