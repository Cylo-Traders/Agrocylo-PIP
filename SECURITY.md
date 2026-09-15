# Security Policy

Agrocylo PIP holds investor and farmer funds in on-chain escrow (Soroban
contracts under `contracts/`). Treat any bug that could affect fund custody,
settlement, or access control as a security issue.

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for a security vulnerability.

Instead, report it privately through GitHub:

1. Go to the [Security tab](../../security/advisories) of this repository.
2. Click **Report a vulnerability** to open a private advisory.

This gives maintainers a chance to assess impact and ship a fix before the
details become public.

## Scope

- `server/` — API, indexer, and business logic
- `client/` — frontend application
- `contracts/` — Soroban smart contracts (escrow, registry)

## What to Include

- A description of the issue and its potential impact
- Steps to reproduce, or a minimal proof of concept
- Affected commit/version, if known
