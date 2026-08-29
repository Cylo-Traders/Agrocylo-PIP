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
- `get_campaign_activities(campaign_id: u64) -> Vec<ActivityRecord>` - Get all activities for a campaign (concatenates every page; for bounded reads use the paged getters below)
- `get_campaign_activity_page_count(campaign_id: u64) -> u32` - Number of activity pages (0-based indices `0..page_count`)
- `get_campaign_activities_page(campaign_id: u64, page: u32) -> Vec<ActivityRecord>` - One page (at most 100 records) of the campaign activity log

Campaign activity is stored as fixed-size pages (`DataKey::CampaignActivitiesPage(campaign_id, page)`, 100 records per page) plus a page-count key, so appends only touch the current page and no single ledger entry grows unbounded.

### Farmer Campaign Functions

- `get_campaigns_by_farmer(farmer: Address) -> Vec<u64>` - Get all campaign ids for a farmer (concatenates every page; for bounded reads use the paged getters below)
- `get_farmer_campaigns_page_count(farmer: Address) -> u32` - Number of campaign-id pages (0-based indices `0..page_count`)
- `get_campaigns_by_farmer_page(farmer: Address, page: u32) -> Vec<u64>` - One page (at most 100 ids) of the farmer's campaign list

A farmer's campaign list is likewise stored as fixed-size pages (`DataKey::FarmerCampaignsPage(farmer, page)`, 100 ids per page) plus a page-count key.

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
