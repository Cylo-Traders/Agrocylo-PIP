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

### Storage expiry & keep-alives

All per-campaign records (`Campaign`, `Dispute`, `Tranches`, `HarvestRecord`,
and each `Contribution`) are stored as Soroban **persistent** entries alongside
the contract's instance data. Persistent entries carry a TTL (time-to-live) in
ledgers; when that TTL lapses an entry becomes **archived** and is no longer
readable until it is explicitly restored (via `RestoreFootprintOp` or an
on-chain read/extension). The contract extends the TTL of every entry it reads
or writes (see `storage.rs`, thresholds/bumps are 30/90 days' worth of ledgers),
so entries that are still actively used are kept alive automatically.

However, once a campaign reaches a terminal state (`Settled`, `Failed`,
`Resolved`) **no write path ever touches its entries again**, and reads only
happen if someone queries them. A settled campaign that is queried for the
first time after its persistent entries' TTL has lapsed will be **archived and
unreadable** — the public getters return `None` and the state-transition paths
that assume a campaign exists will panic with `"campaign not found"`. For an
auditable campaign-history platform, losing read access to completed campaigns
after a few months is an operational risk that must be actively managed.

**Keep-alive:** `touch_campaign(campaign_id)` is a permissionless, state-free
method that extends the TTL of a campaign's `Campaign`, `Dispute`, `Tranches`,
and `HarvestRecord` entries without reading or changing any state. It is
intended to be called periodically by an indexer or keeper job (e.g. once per
extension window, well under the 30-day threshold) so that historical —
especially settled — campaigns remain readable indefinitely. It is a no-op for
a nonexistent campaign.

**What the operator must do:**

- Record the ledger TTL constants: `PERSISTENT_LIFETIME_THRESHOLD` (30 days'
  worth of ledgers) and `PERSISTENT_BUMP_AMOUNT` (90 days') in
  `production_escrow/src/storage.rs`.
- Run `touch_campaign(campaign_id)` on every campaign you care to keep readable
  at a cadence comfortably shorter than 30 days of ledgers (e.g. weekly). This
  keeps the `Campaign`, `Dispute`, `Tranches`, and `HarvestRecord` records
  alive.
- `Contribution` records are keyed per-investor and cannot be enumerated by a
  bulk touch; keep those alive via their ordinary `fund_campaign`/
  `receive_contribution`/`claim_*` reads, or accept that very old contribution
  slots may need a targeted restore.
- If an entry has **already** been archived, `touch_campaign` cannot resurrect
  it (its `has` is false on-chain); it must be restored first via
  `RestoreFootprintOp`. Keep-alives are a *prevention*, not a recovery, tool.

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
| `touch_campaign`    | Permissionless keep-alive: extends TTL of a campaign's persistent storage entries without changing state (see "Storage expiry & keep-alives") |
| `get_campaign`      | Retrieve campaign details                       |

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
