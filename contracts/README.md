# Agrocylo Smart Contracts

Soroban smart contracts for the Agrocylo Production Investment Platform.

## Contracts

### Production Escrow Contract

The Production Escrow Contract manages campaign funding, escrow, tranche releases, harvest reporting, disputes, and settlements.

**Features:**

- Campaign creation and metadata storage
- Investor contribution tracking
- Escrow balance management (`total_funded`, `released`, `refundable`)
- Tranche release to farmers
- Harvest reporting milestones
- Dispute opening and resolution (`FullRefund`, `PartialSettlement`, `FullPayout`)
- Pro-rata investor refund claims
- Final campaign settlement

### Registry Contract

The Registry Contract manages campaign activity records and access control for the platform.

**Features:**

- Activity record logging for campaign events
- Admin configuration and management
- Access control for authorized contracts
- Event emission for indexing services

**Activity Records:**

Activity records track important campaign lifecycle events including:
- Farmer registration
- Campaign registration
- Campaign creation
- Funding events
- Status changes
- Fund releases
- Harvest reports
- Dispute initiation and resolution
- Campaign settlement

**Access Control:**

- Admin-only operations require authorization from the current admin address
- Approved contracts can perform registry operations without additional authorization
- Activity records can be created by admin, approved contracts, or authorized users

## Integration

See [INTEGRATION.md](./INTEGRATION.md) for the full integration guide covering:

- Expected call flow between `ProductionEscrowContract` and `RegistryContract`
- State ownership
- Event indexing responsibilities
- Campaign lifecycle diagram
- Example transaction flows

## Conventions

### Missing-record getters

Every public getter that looks up a record which may not exist returns
`Option<T>` rather than panicking. Callers get `None` for a nonexistent
campaign, dispute, harvest record, or campaign record — never an opaque
Soroban host panic.

```rust
// production_escrow
pub fn get_campaign(env: Env, campaign_id: u64) -> Option<Campaign>;
pub fn get_dispute(env: Env, campaign_id: u64) -> Option<Dispute>;
pub fn get_harvest_record(env: Env, campaign_id: u64) -> Option<HarvestRecord>;

// registry
pub fn get_campaign(env: Env, campaign_id: u64) -> Option<CampaignInfo>;
pub fn get_farmer(env: Env, farmer: Address) -> Option<FarmerProfile>;
pub fn get_campaign_record(env: Env, campaign_id: u64) -> Option<CampaignRecord>;
```

Internal helper functions that mutate an existing record (e.g.
`fund_campaign`, `resolve_dispute`, `update_campaign_status`,
`reconcile_campaign_status`) still expect the record to exist by that
point in the call flow — those unwrap the `Option` locally with a
descriptive `panic!` message rather than propagating it, since the
precondition (the record must already exist) is part of the contract's
internal invariants, not something a caller of the public API should
have to handle. This includes cross-contract calls: `registry`'s
`reconcile_campaign_status` unwraps the `Option<Campaign>` it gets back
from `production_escrow::get_campaign` the same way.

New public getters should follow the same `Option<T>` convention.

## Building

```bash
cargo build --target wasm32-unknown-unknown --release
```

## Testing

```bash
cargo test
```

## Development

### Prerequisites

- Rust toolchain with wasm32-unknown-unknown target
- Soroban CLI tools

### Project Structure

```
contracts/
├── escrow_types/       # Escrow data types, shared — NOT a contract crate
│   ├── src/
│   │   └── lib.rs     # #[contracttype] definitions for the escrow's wire format
│   └── Cargo.toml
├── production_escrow/  # Production escrow contract implementation
│   ├── src/
│   │   ├── lib.rs     # Contract entry point
│   │   ├── storage.rs # Storage utilities
│   │   ├── events.rs  # Event definitions
│   │   └── test.rs    # Test suite
│   └── Cargo.toml
├── registry/           # Registry contract implementation
│   ├── src/
│   │   ├── lib.rs     # Contract entry point
│   │   ├── types.rs   # Data types and enums
│   │   ├── storage.rs # Storage utilities
│   │   ├── admin.rs   # Admin access control
│   │   ├── activity.rs # Activity logging
│   │   ├── campaign.rs # Campaign records and status reconciliation
│   │   ├── escrow.rs  # Declared client for cross-contract escrow calls
│   │   ├── events.rs  # Event definitions
│   │   └── test.rs    # Test suite
│   └── Cargo.toml
├── integration_tests/  # Cross-contract end-to-end tests
├── INTEGRATION.md      # Contract integration documentation
└── Cargo.toml          # Workspace configuration
```

> **Why `escrow_types` is a separate crate:** `registry` needs the escrow's
> `Campaign`/`CampaignStatus` types to reconcile campaign status, but it must
> not depend on the `production_escrow` crate. Both contracts export
> `initialize`, `get_admin` and `get_campaign`, so linking one into the other
> puts duplicate symbols in the wasm module and the release build fails. The
> types live in a plain library crate, and `registry/src/escrow.rs` declares
> the escrow client with `#[contractclient]` instead of linking the contract.

## License

This project is open source.
