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

## Error-handling conventions

Public **read** methods that look up optional on-chain state should return
`Option<T>` (or a documented `Result`) rather than panicking when the key is
missing. This lets frontends and indexers treat "not found" as a normal case
instead of an opaque Soroban host panic.

| Method (contract) | Missing key |
| --- | --- |
| `RegistryContract::get_campaign` / `get_farmer` | `None` |
| `ProductionEscrowContract::get_campaign` | `None` |
| `ProductionEscrowContract::get_dispute` | `None` |
| `ProductionEscrowContract::get_harvest_record` | `None` |

**Write** paths and privileged mutators may still `panic!` (or later use a
shared `#[contracterror]`) when preconditions fail (wrong status, unauthorized
caller, etc.). Prefer clear panic messages until a unified error enum is
introduced.

When adding new public getters, prefer `Option<T>` for existence checks so the
platform stays consistent across contracts.

## Building

```bash
cargo build --target wasm32-unknown-unknown --release
```

## Testing

```bash
cargo test --locked
```

## Development

### Prerequisites

- Rust toolchain with wasm32-unknown-unknown target
- Soroban CLI tools

### Project Structure

```
contracts/
├── production_escrow/  # Production escrow contract implementation
│   ├── src/
│   │   ├── lib.rs     # Contract entry point
│   │   ├── types.rs   # Data types and enums
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
│   │   ├── events.rs  # Event definitions
│   │   └── test.rs    # Test suite
│   └── Cargo.toml
├── INTEGRATION.md      # Contract integration documentation
└── Cargo.toml          # Workspace configuration
```

## License

This project is open source.
