# Soroban Contract Setup Guide

## Prerequisites

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, restart your terminal or run:

```bash
source $HOME/.cargo/env
```

### Add wasm32 Target

```bash
rustup target add wasm32-unknown-unknown
```

### Install Soroban CLI (Optional)

For deployment and interaction with the Stellar network:

```bash
cargo install --locked soroban-cli
```

## Building the Contracts

From the `contracts` directory:

```bash
cargo build --target wasm32-unknown-unknown --release
```

Optimized builds will be located in:
```
target/wasm32-unknown-unknown/release/*.wasm
```

## Running Tests

```bash
cargo test
```

Run tests with output:

```bash
cargo test -- --nocapture
```

Run specific test:

```bash
cargo test test_initialize_admin
```

## Contract Functions

### Admin Functions

- `initialize(admin: Address)` - Initialize contract with admin address
- `update_admin(new_admin: Address)` - Transfer admin role
- `get_admin() -> Address` - Get current admin address
- `approve_contract(contract: Address)` - Approve contract for registry operations
- `revoke_contract(contract: Address)` - Revoke contract approval
- `is_contract_approved(contract: Address) -> bool` - Check contract approval status

### Activity Functions

- `record_activity(campaign_id: u64, actor: Address, action_type: ActivityAction)` - Record campaign activity
- `get_campaign_activities(campaign_id: u64) -> Vec<ActivityRecord>` - Get all activities for a campaign

### Activity Action Types

- `CampaignCreated`
- `CampaignFunded`
- `CampaignStatusChanged`
- `FundsReleased`
- `HarvestReported`
- `DisputeInitiated`
- `DisputeResolved`
- `CampaignSettled`

## Deployment

Using Soroban CLI:

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/registry.wasm \
  --source <your-stellar-account> \
  --network testnet
```

Initialize after deployment:

```bash
soroban contract invoke \
  --id <deployed-contract-id> \
  --source <admin-account> \
  --network testnet \
  -- \
  initialize \
  --admin <admin-address>
```

## Testing Strategy

The test suite covers:

1. Admin initialization and management
2. Admin transfer functionality
3. Contract approval and revocation
4. Activity record creation
5. Activity retrieval
6. Multi-campaign activity tracking
7. Authorization checks
8. All activity action types
9. Timestamp and ledger sequence recording
10. Deterministic ordering of activity records

## Security Considerations

- Admin can only be set once during initialization
- Admin operations require proper authorization
- Approved contracts have limited registry access
- Activity records include actor verification
- All state changes emit events for indexing
- Storage TTL management prevents data expiration
