
## ProductionEscrowContract

This directory contains the Soroban contract workspace for the Agrocylo
Production Investment Layer.

### Campaign creation

`ProductionEscrowContract::create_campaign` initializes a production funding
campaign. It accepts:

- `campaign_id`: unique `BytesN<32>` campaign identifier.
- `farmer`: authorized campaign owner.
- `funding_target`: target amount; must be greater than zero.
- `token_address`: Soroban token contract address used for funding.
- `deadline`: funding deadline or timeline timestamp.
- `harvest`: expected harvest metadata, including crop type, quantity,
  expected harvest date, region, and compact metadata hash.

Creation requires `farmer.require_auth()`. Campaign IDs are globally unique and
cannot be reused. Newly created campaigns are stored with `Funding` status and a
`campaign-created` contract event is emitted after storage succeeds.

Use `get_campaign(campaign_id)` to retrieve the stored campaign details.

# Agrocylo Smart Contracts

Soroban smart contracts for the Agrocylo Production Investment Platform.

## Contracts

### Registry Contract

The Registry Contract manages campaign activity records and access control for the platform.

**Features:**

- Activity record logging for campaign events
- Admin configuration and management
- Access control for authorized contracts
- Event emission for indexing services

**Activity Records:**

Activity records track important campaign lifecycle events including:
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
└── Cargo.toml         # Workspace configuration
```

## License

This project is open source.
