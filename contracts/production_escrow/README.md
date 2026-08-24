# ProductionEscrowContract

Soroban smart contract for production campaign escrow workflows on the Agrocylo platform.

## Overview

The `ProductionEscrowContract` manages the lifecycle of agricultural production campaigns, from funding through settlement. Funds are held in escrow and released based on campaign progress.

### Campaign Lifecycle

```
Active -> Funding -> Funded -> InProduction -> Harvested -> Settled
```

Alternative terminal states:
- `Failed`
- `Disputed`
- `Resolved`

### Campaign Statuses

| Status        | Description                                      |
|---------------|--------------------------------------------------|
| `Active`      | Campaign created, no contributions yet           |
| `Funding`     | Campaign created, accepting investor funds       |
| `Funded`      | Minimum funding goal reached                     |
| `InProduction`| Production phase started                         |
| `Harvested`   | Farmer reported harvest completion               |
| `Settled`     | Funds distributed according to campaign rules    |
| `Failed`      | Campaign failed, refunds processed               |
| `Disputed`    | Dispute initiated, awaiting resolution           |
| `Resolved`    | Dispute resolved, funds allocated                |

## Public Methods

| Method              | Description                                     |
|---------------------|-------------------------------------------------|
| `initialize`        | Initialize contract state                       |
| `create_campaign`   | Create a new campaign (farmer auth required)    |
| `fund_campaign`     | Fund a campaign (investor auth required; real token transfer) |
| `receive_contribution` | Admin reconciliation of an off-chain-verified contribution (admin **and** farmer auth required; no token transfer — see "Trust model" below) |
| `configure_tranches`| Configure tranches (admin auth required)        |
| `release_tranche`   | Release next tranche (admin auth required; transitions campaign to `InProduction` on first call) |
| `report_harvest`    | Report harvest completion                       |
| `settle_campaign`   | Settle campaign and distribute funds            |
| `mark_failed`       | Mark campaign as failed, trigger refunds        |
| `open_dispute`      | Enter dispute state                             |
| `get_campaign`      | Retrieve campaign details (`Option`)            |
| `touch_campaign`    | Permissionless TTL keep-alive (no state change) |

## Trust model: `receive_contribution`

`receive_contribution` is an admin-only bookkeeping path for recording a
contribution that was verified off-chain (e.g. funds that reached the
contract's token balance through a rail other than `fund_campaign`, such as
a bridge deposit or a manually reconciled transfer). It does **not** move
tokens itself.

Because it increases `campaign.total_funded` — the denominator used to
compute pro-rata payouts in `claim_refund`/`claim_return` — without an
accompanying transfer, it is treated as a highly privileged operation with
two layers of hardening:

1. **Solvency invariant.** After recording the contribution, the contract
   asserts that its recorded liabilities
   (`total_funded - released - refundable - returnable`) do not exceed its
   actual on-chain token balance (`token.balance(contract_address)`). If a
   reconciliation would claim more than the contract really holds, the call
   panics and nothing is written. This is also enforced on `fund_campaign`.
   The escrow can never claim to hold more than it actually holds.
2. **Second signer.** The call requires **both** the admin's and the
   campaign farmer's `require_auth()`. A single compromised admin key can no
   longer unilaterally fabricate a contribution — the farmer, who has a
   direct financial stake in accurate accounting, must co-sign.

Additionally, `receive_contribution` emits a distinctly-named
`ContribReconciled` event (as opposed to `ContribReceived`, emitted by real
`fund_campaign` deposits), so off-chain indexers/monitoring can flag and
alert on reconciliations separately from genuine deposits.

**Residual risk:** the solvency check only bounds a reconciliation to the
contract's *existing* balance — if admin and farmer collude, or if tokens
already sit in the contract for other reasons (e.g. a partially-drained
tranche release path), `receive_contribution` can still redirect who is
credited for those tokens. The safeguards above are designed to prevent a
*unilateral* single-key compromise from inflating claims beyond reality, not
to fully eliminate risk from a two-party collusion. Integrators relying on
`receive_contribution` should treat `ContribReconciled` events as requiring
off-chain audit, separate from ordinary `ContribReceived` deposit monitoring.

## TTL, archival, and historical reads

Soroban persistent entries are **not immortal**. Each write (and some reads)
calls `extend_ttl` with:

| Constant | Value | Meaning |
|----------|-------|---------|
| `PERSISTENT_LIFETIME_THRESHOLD` | `DAY_IN_LEDGERS * 30` (518,400 ledgers, ~30 days) | Remaining TTL must fall below this before a bump happens |
| `PERSISTENT_BUMP_AMOUNT` | `DAY_IN_LEDGERS * 90` (1,555,200 ledgers, ~90 days) | Target remaining TTL after a bump |

(`DAY_IN_LEDGERS` is 17,280, ~5 seconds per ledger.) Instance storage uses the
same 30/90-day window.

### Which entries stop being written once a campaign is terminal

A campaign is terminal in `Settled`, `Failed`, or `Resolved` (and `Disputed`
blocks further tranche releases). After the last mutating call:

| Key | Last writer | Still bumped on read? |
|-----|-------------|------------------------|
| `DataKey::Campaign(id)` | `settle_campaign` / `mark_failed` / `resolve_dispute` | Yes — `get_campaign` |
| `DataKey::Dispute(id)` | `resolve_dispute` | Yes — `get_dispute` |
| `DataKey::HarvestRecord(id)` | `report_harvest` | Yes — `get_harvest_record` |
| `DataKey::Tranches(id)` | `configure_tranches` / `release_tranche` | **No** — `get_tranches` does not extend TTL |
| `DataKey::Contribution(id, investor)` | `claim_refund` / `claim_return` (zeros the slot) | Yes — `get_contribution` for that investor |

If nobody reads or writes an entry, its TTL runs out. An archived persistent
entry is unreadable until restored; public getters return `Option` for a
**missing** live key (`None`), but an **archived** key fails at the host.
Mutating methods that require the campaign (`require_campaign`) panic with a
message that points at restore / `touch_campaign`.

`touch_campaign` does **not** enumerate per-investor `Contribution` keys
(there is no on-chain investor index). Keep those alive by reading
`get_contribution` for known investors, or restore them with
`RestoreFootprintOp` if they archive.

### Keep-alive: `touch_campaign`

```
touch_campaign(campaign_id)
```

Permissionless. Extends TTL on `Campaign` and, when present, `Dispute`,
`Tranches`, and `HarvestRecord`, plus the contract instance. It does not
change any stored value.

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
cargo build --target wasm32-unknown-unknown --release -p production_escrow
```

## Testing

```bash
# Unit tests
cargo test -p production_escrow

# Property-based invariant tests only
cargo test -p production_escrow proptest

# More cases (default is 200 per suite; CI uses 1000)
PROPTEST_CASES=2000 cargo test -p production_escrow proptest

# Reproduce a specific failure by seed
PROPTEST_SEED=0xDEADBEEF cargo test -p production_escrow proptest
```

### Property-based invariants (`src/proptest_invariants.rs`)

Three financial invariants verified across arbitrary investor contributions:

| Test | Invariant |
|------|-----------|
| `prop_failed_campaign_refunds_bounded` | `sum(claimed_refunds) ≤ campaign.refundable` and all contribution slots zeroed after claim |
| `prop_settled_campaign_returns_bounded` | `sum(claimed_returns) ≤ campaign.returnable` and all contribution slots zeroed after claim |
| `prop_partial_settlement_conservation` | `released + refundable == held` exactly — no rounding loss; `escrow_held == 0` after resolution |

The pro-rata arithmetic `contributed * refundable / total_funded` truncates toward zero, so
`sum(claimed) ≤ refundable` with any unallocated dust remaining in the contract permanently
(no sweep path). The conservation test verifies there is **no** such dust for the
`payout + refundable = held` identity, which uses exact subtraction rather than pro-rata division.

## Project Structure

```
production_escrow/
├── src/
│   ├── lib.rs                  # Contract entry point
│   ├── types.rs                # Data types (CampaignStatus enum, Campaign struct, DataKey)
│   ├── storage.rs              # Storage helpers
│   ├── test.rs                 # Unit test suite
│   └── proptest_invariants.rs  # Property-based financial invariants
└── Cargo.toml
```

## Prerequisites

- Rust toolchain with `wasm32-unknown-unknown` target
- Soroban CLI tools

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked soroban-cli
```
