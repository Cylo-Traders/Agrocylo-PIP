# Contributing to Agrocylo PIP

Thanks for contributing. This guide lists the exact commands CI runs, so you can
get a green build locally before you push.

## Repository layout

The repo holds three independent projects, each with its own toolchain, its own
dependency install, and its own CI workflow. There is no root-level package —
always run commands from inside the project directory you are changing.

| Directory   | Stack                     | Workflow                            |
| ----------- | ------------------------- | ----------------------------------- |
| `client/`   | React + Vite + TypeScript | `.github/workflows/client-ci.yml`   |
| `server/`   | NestJS + Prisma + libSQL  | `.github/workflows/server.yml`      |
| `contracts/`| Rust + Soroban SDK        | `.github/workflows/contracts.yml`   |

A workflow only runs when its own directory changes, so a client-only PR will
not trigger the server or contracts checks.

## Prerequisites

- **Node.js >= 22.12** for `client/` and `server/`. Both declare this in
  `engines`; older versions print `EBADENGINE` warnings and can break the
  `lint-staged` pre-commit hook.
- **Rust (stable)** with the `wasm32-unknown-unknown` target for `contracts/`:
  ```bash
  rustup target add wasm32-unknown-unknown
  rustup component add rustfmt clippy
  ```

## Client

```bash
cd client
npm ci

npm run lint          # eslint
npm run format:check  # prettier, check-only
npm run typecheck     # tsc -b
npm test              # vitest
npm run build         # tsc -b && vite build
```

`npm run lint:fix` and `npm run format` apply fixes rather than reporting them.

Copy `.env.example` to `.env` for local development. Every variable is optional —
the app falls back to local data when the Soroban and backend URLs are unset —
but any new `VITE_*` variable must be added to both `.env.example` and the
`ImportMetaEnv` interface in `src/vite-env.d.ts`, or `npm run typecheck` fails.

## Server

```bash
cd server
npm ci                # runs `prisma generate` via postinstall

npm run lint          # eslint, check-only
npm run format:check  # prettier, check-only
npm run typecheck     # tsc --noEmit (covers src/ and test/)
npm run build         # nest build
npm test              # jest unit tests
npm run test:e2e      # jest e2e tests
```

`npm run lint:fix` and `npm run format` apply fixes. Note that `lint` is
deliberately check-only — CI must report formatting problems, not silently
rewrite your files.

The e2e suite boots the real Nest application, so two environment variables must
be set. CI sets both; locally, copy `.env.example` to `.env` or export them:

```bash
export CORS_ALLOWED_ORIGINS=http://localhost:5173
export DATABASE_URL=file:./dev.db
```

`CORS_ALLOWED_ORIGINS` has no default and the app fails fast without it. libSQL
creates the `DATABASE_URL` file on first connection, so no migration or database
server is needed just to run the tests.

The Soroban indexer stays switched off until `PRODUCTION_ESCROW_CONTRACT_ID` or
`ESCROW_CONTRACT_ID` is set. That is the expected state locally and in CI, and
`/health` reports the indexer as `up` with `enabled: false` rather than failing.

## Contracts

```bash
cd contracts

cargo fmt --all --check
cargo clippy --all-targets --all-features -- -D warnings
cargo build --target wasm32-unknown-unknown --release
cargo test
PROPTEST_CASES=1000 cargo test -p production_escrow proptest
```

Run `cargo fmt --all` to apply formatting. CI denies all clippy warnings, so
resolve them rather than leaving them in the output.

`cargo test` writes Soroban snapshot files under `*/test_snapshots/`. These are
build output, are listed in `contracts/.gitignore`, and must not be committed.

## Pre-commit hook

`client/` installs a Husky hook that runs `lint-staged` over staged files. It is
set up automatically by `npm ci` in `client/`. If you have not installed the
client dependencies the hook is simply absent — commits still work, but run the
checks above before pushing.

## Opening a pull request

1. Branch off `master`.
2. Run the checks for every directory you touched.
3. Keep the change scoped to one project where possible — it keeps CI fast and
   reviews focused.
