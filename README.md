# 🌾 Agrocylo Production Investment Platform

A decentralized platform for agricultural financing, investment, and trade. Connecting farmers and investors peer to peer, building on the Stellar Network.

## Overview

Agrocylo brings together two core systems:

- **[P2P Escrow Marketplace](https://github.com/Cylo-Traders/Agrocylo-Global)** for direct farmer–consumer transactions and
- **Production Investment Layer** for campaign-based agricultural funding

This repository focuses on the Production Investment Layer, where users fund farming campaigns and share in harvest outcomes.

## Vision

The project aims to build a decentralized agricultural economy where:

- farmers access fair financing
- buyers access transparent markets
- investors support real-world production

## Architecture

Frontend → Backend → Smart Contracts

- **Frontend**: web application user interface
- **Backend**: indexing, APIs, analytics, and business logic
- **Smart Contracts**: Soroban contracts handling escrow and campaign workflows

Main smart contracts:

- `ProductionEscrowContract`
- `EscrowContract`
- `RegistryContract`

## Key Features

### Campaign-Based Financing

- Farmers create campaigns with funding targets, production timelines, and harvest expectations
- Investors participate early in the agricultural value chain

### Pooled Investments

- Multiple investors can fund a campaign
- Ownership and returns are distributed proportionally

### Escrowed Capital

- Funds are held in on-chain escrow
- Releases happen in controlled tranches based on campaign progress

### Harvest & Settlement

- Farmers report harvest outcomes
- Smart contracts settle funds and returns according to the campaign rules

### Dispute Resolution

- Multi-party dispute flow for campaign disagreements
- Admin arbitration included in the initial version
- Possible outcomes:
  - full refund
  - partial settlement
  - full payout

### Analytics & Price Discovery

- Production trend monitoring
- Regional pricing insights
- Demand vs. supply signal tracking

### Registry Layer

- Connects farmers, campaigns, and activity records
- Supports discovery and indexing of campaigns

## Campaign Lifecycle

`FUNDING → FUNDED → IN_PRODUCTION → HARVESTED → SETTLED`

Alternative states:

- `FAILED`
- `DISPUTED`

## Actors

### Farmer

- creates and manages campaigns
- receives funds and settlement payouts

### Investor

- funds campaigns
- earns returns
- participates in dispute processes if needed

### Admin (Initial Version)

- handles disputes
- maintains platform integrity
- ensures fair outcomes

## Design Principles

- Non-custodial funds in on-chain escrow
- Transparent campaign lifecycle
- Risk-aware agricultural financing
- Event-driven architecture
- Separation of trade and financing logic

## Integration

This platform integrates:

- escrow trading systems
- backend indexing services
- analytics engines
- wallet-based transaction flows

## Development Setup

### Client

```bash
cd client
npm ci
```

Run `npm ci` (not `npm install --ignore-scripts`): the `prepare` script wires Husky into the install and sets up the pre-commit hook, which runs `lint-staged` (`eslint --fix` + `prettier --write`) on staged files. Unformatted or lint-failing staged code is auto-fixed or blocks the commit.

Useful client checks:

- `npm run lint`
- `npm run format:check`
- `npm run typecheck`
- `npm test`

## Contributing

Contributions are welcome in:

- smart contracts (Soroban)
- backend services (indexing, analytics)
- frontend UI/UX
- testing and security
