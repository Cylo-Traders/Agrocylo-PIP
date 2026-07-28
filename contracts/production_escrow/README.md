# ProductionEscrowContract

Soroban smart contract for production campaign escrow workflows on the Agrocylo platform.

## Overview

The `ProductionEscrowContract` manages the lifecycle of agricultural production campaigns, from funding through settlement. Funds are held in escrow and released based on campaign progress.

### Campaign Lifecycle

```
Funding -> Funded -> InProduction -> Harvested -> Settled
```

Alternative terminal states:
- `Failed`
- `Disputed`

### Campaign Statuses

| Status        | Description                                      |
|---------------|--------------------------------------------------|
| `Funding`     | Campaign created, accepting investor funds       |
| `Funded`      | Minimum funding goal reached                     |
| `InProduction`| Production phase started                         |
| `Harvested`   | Farmer reported harvest completion               |
| `Settled`     | Funds distributed according to campaign rules    |
| `Failed`      | Campaign failed, refunds processed               |
| `Disputed`    | Dispute initiated, awaiting resolution           |

## Public Methods

| Method              | Description                                     |
|---------------------|-------------------------------------------------|
| `initialize`        | Initialize contract state                       |
| `create_campaign`   | Create a new campaign (farmer auth required)    |
| `fund_campaign`     | Fund a campaign (investor auth required)        |
| `configure_tranches`| Configure tranches (admin auth required)        |
| `release_tranche`   | Release next tranche (admin auth required; transitions campaign to `InProduction` on first call) |
| `report_harvest`    | Report harvest completion                       |
| `settle_campaign`   | Settle campaign and distribute funds            |
| `mark_failed`       | Mark campaign as failed, trigger refunds        |
| `open_dispute`      | Enter dispute state                             |
| `get_campaign`      | Retrieve campaign details                       |

## Building

```bash
cargo build --target wasm32-unknown-unknown --release -p production_escrow
```

## Testing

```bash
cargo test -p production_escrow
```

## Project Structure

```
production_escrow/
├── src/
│   ├── lib.rs      # Contract entry point
│   ├── types.rs    # Data types (CampaignStatus enum, Campaign struct, DataKey)
│   ├── storage.rs  # Storage helpers
│   └── test.rs     # Test suite
└── Cargo.toml
```

## Prerequisites

- Rust toolchain with `wasm32-unknown-unknown` target
- Soroban CLI tools

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked soroban-cli
```
