# RegistryContract

Soroban smart contract for campaign registry, farmer profiles, and activity
audit trails on the Agrocylo platform.

## Overview

The `RegistryContract` stores farmer-authored campaign metadata, a
lifecycle-status mirror of the linked `ProductionEscrowContract`, paged
activity logs, and access control (admin + approved contracts).

See [INTEGRATION.md](../INTEGRATION.md) for how this contract is meant to be
driven alongside the escrow contract.

## Public Methods

| Method | Description |
|--------|-------------|
| `initialize` | Set the admin (once) |
| `update_admin` | Replace the admin (admin auth) |
| `approve_contract` / `revoke_contract` | Allowlist for cross-contract callers |
| `register_farmer` / `get_farmer` | Farmer profile |
| `register_campaign` / `get_campaign` | Farmer-authored title/description (`Option`) |
| `link_campaign_escrow` | Bind a campaign to its escrow instance |
| `update_campaign_status` | Mirror escrow lifecycle status |
| `get_campaign_record` | Escrow-linked record (`Option`) |
| `record_activity` / `get_campaign_activities` | Paged activity log |
| `reconcile_campaign_status` | Permissionless status-mirror self-heal |
| `touch_campaign` | Permissionless TTL keep-alive (no state change) |

## TTL, archival, and historical reads

Soroban persistent entries are **not immortal**. Each write calls `extend_ttl`
with:

| Constant | Value | Meaning |
|----------|-------|---------|
| `PERSISTENT_LIFETIME_THRESHOLD` | `DAY_IN_LEDGERS * 30` (518,400 ledgers, ~30 days) | Remaining TTL must fall below this before a bump happens |
| `PERSISTENT_BUMP_AMOUNT` | `DAY_IN_LEDGERS * 90` (1,555,200 ledgers, ~90 days) | Target remaining TTL after a bump |

(`DAY_IN_LEDGERS` is 17,280, ~5 seconds per ledger.) Instance storage uses the
same 30/90-day window.

### Which entries stop being written once a campaign is terminal

After the last `update_campaign_status` (typically to `Settled`, `Failed`, or
`Resolved`) and the last `record_activity` for that campaign, nothing mutates
the campaign's persistent keys again:

| Key | Last writer | Still bumped on read? |
|-----|-------------|------------------------|
| `DataKey::Campaign(id)` | `register_campaign` (never updated after) | **No** — `get_campaign` does not extend TTL |
| `DataKey::CampaignRecord(id)` | `update_campaign_status` / `reconcile_campaign_status` | Yes — `get_campaign_record` |
| `DataKey::CampaignActivitiesPageCount(id)` | `record_activity` | **No** |
| `DataKey::CampaignActivitiesPage(id, n)` | `record_activity` (only the current last page) | **No** — earlier pages are never rewritten |

Farmer-keyed entries (`Farmer`, `FarmerCampaignsPage`,
`FarmerCampaignsPageCount`) are not campaign-scoped. They stay alive only
while that farmer is still registering/linking campaigns (or via an explicit
`RestoreFootprintOp`). `touch_campaign` does not bump them.

If nobody writes those keys, TTL runs out. An archived persistent entry is
unreadable until restored; public getters return `Option` for a **missing**
live key (`None`), but an **archived** key fails at the host. Mutating methods
that require the record (`require_campaign_record`) panic with a message that
points at restore / `touch_campaign`.

### Keep-alive: `touch_campaign`

```
touch_campaign(campaign_id)
```

Permissionless. Extends TTL on `Campaign` metadata and/or `CampaignRecord`
when present, every activity page plus the page-count key, and the contract
instance. It does not change any stored value. Succeeds if either the
metadata entry or the escrow-linked record exists.

**Suggested indexer cadence:** call `touch_campaign` at least once every ~30
days for every campaign whose history must stay readable. `extend_ttl` is a
no-op while remaining TTL is still above the 30-day threshold, so monthly
calls are cheap and will bump once remaining life drops below the threshold
(~60 days after the last bump).

### Restore path

If an entry has already archived, `touch_campaign` cannot revive it. Submit a
[`RestoreFootprintOp`](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival)
for the archived keys (and the contract instance / WASM if those archived too),
then resume periodic `touch_campaign` calls.

## Building

```bash
cargo build --target wasm32-unknown-unknown --release -p registry
```

## Testing

```bash
cargo test -p registry
```

## Project Structure

```
registry/
├── src/
│   ├── lib.rs       # Contract entry point
│   ├── types.rs     # Data types and DataKey
│   ├── storage.rs   # Storage helpers and TTL constants
│   ├── admin.rs     # Admin / allowlist
│   ├── farmer.rs    # Farmer profiles
│   ├── campaign.rs  # Campaign metadata, escrow link, status mirror
│   ├── activity.rs  # Paged activity log
│   ├── events.rs    # Event definitions
│   └── test.rs      # Unit test suite
└── Cargo.toml
```
