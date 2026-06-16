# Verification Guide

This guide explains how to verify the Registry Contract implementation meets all requirements from Issue #9.

## Prerequisites

Ensure Rust and Cargo are installed:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

## Running Tests

Navigate to the contracts directory and run the test suite:

```bash
cd contracts
cargo test
```

Expected output should show all tests passing:

```
running 19 tests
test test::test_initialize_admin ... ok
test test::test_initialize_admin_twice_fails ... ok
test test::test_update_admin ... ok
test test::test_update_admin_unauthorized_fails ... ok
test test::test_approve_contract ... ok
test test::test_revoke_contract ... ok
test test::test_approve_contract_unauthorized_fails ... ok
test test::test_record_activity_as_admin ... ok
test test::test_record_activity_as_approved_contract ... ok
test test::test_record_multiple_activities ... ok
test test::test_activities_different_campaigns ... ok
test test::test_get_activities_empty_campaign ... ok
test test::test_activity_timestamp_and_ledger ... ok
test test::test_record_activity_as_authorized_user ... ok
test test::test_all_activity_actions ... ok
```

## Verification Checklist

### Activity Record Logging

#### ✅ Activity Record Data Model
**Verify:** Check `registry/src/types.rs`

```bash
grep -A 10 "pub struct ActivityRecord" registry/src/types.rs
```

Should show:
- actor: Address
- action_type: ActivityAction
- timestamp: u64
- ledger_sequence: u32

#### ✅ Activity Recording Function
**Verify:** Check `registry/src/activity.rs`

```bash
grep -A 5 "pub fn record_activity" registry/src/activity.rs
```

#### ✅ Activity Authorization
**Verify:** Run authorization tests

```bash
cargo test test_record_activity
```

All tests should pass, confirming:
- Admin can record activities
- Approved contracts can record activities
- Authorized users can record activities

#### ✅ Activity Lookup
**Verify:** Check retrieval function

```bash
grep -A 5 "pub fn get_campaign_activities" registry/src/activity.rs
```

Run tests:

```bash
cargo test test_get_campaign_activities
cargo test test_activities_different_campaigns
```

#### ✅ Activity Events
**Verify:** Check event emission

```bash
grep "activity_recorded" registry/src/events.rs
```

#### ✅ Activity Tests
**Verify:** Run all activity tests

```bash
cargo test test_record_activity
cargo test test_get_activities
cargo test test_all_activity_actions
```

### Admin and Access Control

#### ✅ Admin Initialization
**Verify:** Run initialization tests

```bash
cargo test test_initialize_admin
cargo test test_initialize_admin_twice_fails
```

Should confirm:
- Admin can be set during initialization
- Re-initialization is prevented

#### ✅ Admin Transfer
**Verify:** Run admin update tests

```bash
cargo test test_update_admin
cargo test test_update_admin_unauthorized_fails
```

Should confirm:
- Admin can transfer role
- Non-admin cannot update admin

#### ✅ Admin Helpers
**Verify:** Check admin module

```bash
grep -E "require_admin|get_admin" registry/src/admin.rs
```

#### ✅ Contract Approval
**Verify:** Run contract approval tests

```bash
cargo test test_approve_contract
cargo test test_revoke_contract
cargo test test_approve_contract_unauthorized_fails
```

#### ✅ Admin Events
**Verify:** Check event definitions

```bash
grep -E "admin_updated|contract_approved|contract_revoked" registry/src/events.rs
```

#### ✅ Admin Tests
**Verify:** Run all admin tests

```bash
cargo test test_initialize
cargo test test_update_admin
cargo test test_approve_contract
cargo test test_revoke_contract
```

## Building the Contract

Build the contract to ensure it compiles without errors:

```bash
cargo build --target wasm32-unknown-unknown --release
```

Successful build should produce:

```
target/wasm32-unknown-unknown/release/registry.wasm
```

## Code Coverage Verification

### Activity Records Coverage
- [x] Activity record creation
- [x] Activity record retrieval
- [x] Authorization checks
- [x] Multiple activities per campaign
- [x] Activities across campaigns
- [x] Empty campaign queries
- [x] Timestamp recording
- [x] Ledger sequence recording
- [x] All action types
- [x] Deterministic ordering

### Admin Coverage
- [x] Admin initialization
- [x] Duplicate initialization prevention
- [x] Admin retrieval
- [x] Admin transfer
- [x] Unauthorized admin operations
- [x] Contract approval
- [x] Contract revocation
- [x] Contract approval checks
- [x] Unauthorized contract operations

## Integration Testing

While unit tests verify individual functions, integration testing should verify:

1. Contract deployment and initialization
2. Admin operations in sequence
3. Activity recording from multiple actors
4. Event emission and indexing
5. Storage TTL behavior

These can be tested on testnet once deployment tooling is configured.

## Acceptance Criteria Verification

Run this command to verify all tests pass:

```bash
cargo test 2>&1 | grep -E "test result:|running"
```

Expected output:
```
running 19 tests
test result: ok. 19 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

All 19 tests passing confirms all acceptance criteria are met.

## Performance Notes

The implementation uses efficient storage patterns:

- Instance storage for global state (admin, approvals)
- Persistent storage for activity records
- Vector-based activity storage (O(1) append, O(n) retrieval)
- TTL management prevents data expiration

For campaigns with thousands of activities, consider implementing pagination in future versions.

## Security Audit Points

Key security features to verify:

1. Admin cannot be overwritten after initialization
2. Only admin can approve contracts
3. Activity records are append-only
4. Authorization is checked before state changes
5. Events are emitted for all state changes
6. Storage TTL is properly managed

## Troubleshooting

If tests fail:

1. Ensure Rust toolchain is up to date: `rustup update`
2. Clean and rebuild: `cargo clean && cargo build`
3. Check for missing dependencies: `cargo check`
4. Verify wasm32 target is installed: `rustup target list --installed`

For build errors:

1. Check Cargo.toml versions match workspace
2. Ensure soroban-sdk version is compatible
3. Verify all module declarations in lib.rs

## Next Steps

After verification:

1. Deploy to Stellar testnet
2. Initialize with admin address
3. Test with real transactions
4. Set up indexing service to consume events
5. Integrate with escrow contracts
6. Build frontend integration
