# ProductionEscrowContract & RegistryContract Integration

This document describes how the `ProductionEscrowContract` and `RegistryContract` interact during the campaign lifecycle, which contract owns each piece of state, how events should be indexed, and example transaction flows.

## Overview

- **ProductionEscrowContract** owns campaign financial state (funding, escrow, disputes, settlements) and emits canonical events for every state change.
- **RegistryContract** owns the audit trail of campaign activities and access-control lists (admin, approved contracts). It is the source of truth for *who* did *what* and *when*.

In the intended integration, `ProductionEscrowContract` (or an authorized backend service acting on its behalf) calls `RegistryContract::record_activity` after each significant lifecycle step. The `ProductionEscrowContract` address must first be registered in the `RegistryContract` via `approve_contract`.

## Contract Responsibilities

### ProductionEscrowContract

| Responsibility | Implementation |
|----------------|----------------|
| Campaign creation & metadata | `create_campaign` |
| Receiving investor token contributions | `fund_campaign` |
| Reconciling externally verified contributions | `receive_contribution` (admin only) |
| Marking a reconciled campaign as fully funded | `complete_funding` (admin only) |
| Releasing tranches to the farmer | `release_tranche` |
| Recording harvest milestones | `report_harvest` |
| Opening & resolving disputes | `open_dispute`, `resolve_dispute` |
| Investor refunds after resolution | `claim_refund` |
| Final campaign settlement | `settle_campaign` |
| Event emission for all state transitions | Soroban events (see table below) |

### RegistryContract

| Responsibility | Implementation |
|----------------|----------------|
| Admin management | `initialize`, `update_admin`, `get_admin` |
| Approved-contract allowlist | `approve_contract`, `revoke_contract`, `is_contract_approved` |
| Recording campaign audit activities | `record_activity` |
| Retrieving campaign activity history | `get_campaign_activities` |
| Event emission for registry changes | Soroban events (see table below) |

## State Ownership

| State | Owner | Storage Type | Key / Notes |
|-------|-------|--------------|-------------|
| Admin address | RegistryContract | Instance | `DataKey::Admin` |
| Approved contract list | RegistryContract | Instance | `DataKey::ApprovedContract(Address)` |
| Campaign activity history | RegistryContract | Persistent | `DataKey::CampaignActivities(u64)` |
| Campaign metadata (farmer, target, token, deadline, harvest) | ProductionEscrowContract | Persistent | `DataKey::Campaign(u64)` |
| Campaign financials (`total_funded`, `released`, `refundable`) | ProductionEscrowContract | Persistent | Inside `Campaign` struct |
| Campaign status | ProductionEscrowContract | Persistent | `Campaign.status` (`CampaignStatus`) |
| Investor contribution ledger | ProductionEscrowContract | Persistent | `DataKey::Contribution(u64, Address)` |
| Dispute record | ProductionEscrowContract | Persistent | `DataKey::Dispute(u64)` |

> **Rule of thumb:** Financial and dispute state lives in `ProductionEscrowContract`. Audit and access-control state lives in `RegistryContract`.

## Rounding / Dust Policy

Both `claim_refund` and `claim_return` compute the investor's pro-rata share via integer division:

```
share = contributed * pool_amount / total_funded
```

where `pool_amount` is either `refundable` or `returnable`. This truncates toward zero, meaning each investor may receive a few stroops less than their exact fractional entitlement. The truncated "dust" remains permanently in the contract — there is no sweep or recovery function.

**Integrator guidance:**

- `sum(all claimed refunds) <= refundable` and `sum(all claimed returns) <= returnable` always hold.
- The residual `pool_amount - sum(claimed)` represents accumulated truncation dust and should be expected in analytics or campaign close-out reporting.
- For typical campaign sizes the dust per investor is at most 1 stroop; accumulated dust across many investors is negligible in practice.

## Campaign Lifecycle

The logical lifecycle maps to the contract statuses as follows:

| Logical Phase | Contract Status | Triggering Escrow Method |
|---------------|-----------------|--------------------------|
| **Funding** | `Active` / `Funding` | `create_campaign` (Active), first contribution (Funding) |
| **Funded** | `Funded` | `fund_campaign` when target is reached, or admin `complete_funding` after authorized reconciliation |
| **InProduction** | `InProduction` | `release_tranche` (first call transitions to `InProduction`) |
| **Harvested** | `Harvested` | `report_harvest` |
| **Settled** | `Settled` | `settle_campaign` |

Alternative terminal statuses:
- **Failed**: Contract Status `Failed`, triggered by admin `mark_failed`. This **is** a distinct on-chain status stored in `Campaign.status`; `CampaignFailed` is emitted and investors can call `claim_refund` to recover funds.
- **Disputed**: Contract Status `Disputed`, triggered by `open_dispute`
- **Resolved**: Contract Status `Resolved`, triggered by admin `resolve_dispute`

### Lifecycle Diagram

```
[Funding / Active]
       |
       v
[Funded] --[release_tranche (first call)]--> [InProduction]
   |                                               |
   |                                               |--[release_tranche (subsequent)]
   |                                               v
   +--------------[report_harvest]-------------> [Harvested]
                                                   |
                                                   v
                                               [Settled]

Alternative Paths:
- [Active / Funding / Funded / InProduction] --[open_dispute]--> [Disputed] --[resolve_dispute]--> [Resolved] --[claim_refund]--> [RefundClaimed]*
- [Active / Funding / Funded / InProduction] --[mark_failed]--> [Failed] --[claim_refund]--> [RefundClaimed]*
```

\* `RefundClaimed` is a per-investor action, not a global campaign status transition.

## Expected Call Flow Between Contracts

The table below shows the expected cross-contract calls. After each escrow action, the escrow contract (or an approved orchestrator) should invoke `RegistryContract::record_activity` to append an audit entry.

| Escrow Action | Registry Call | `ActivityAction` | Actor |
|---------------|---------------|------------------|-------|
| `create_campaign` | `record_activity(campaign_id, farmer, CampaignCreated)` | `CampaignCreated` | Farmer |
| `fund_campaign` | `record_activity(campaign_id, investor, CampaignStatusChanged)` | `CampaignStatusChanged` | Investor |
| `receive_contribution` | `record_activity(campaign_id, investor, CampaignStatusChanged)` | `CampaignStatusChanged` | Admin, after off-chain funds are verified |
| `complete_funding` | `record_activity(campaign_id, farmer, CampaignFunded)` | `CampaignFunded` | Admin |
| `release_tranche` | `record_activity(campaign_id, recipient, FundsReleased)` | `FundsReleased` | Farmer (recipient) |
| `report_harvest` | `record_activity(campaign_id, farmer, HarvestReported)` | `HarvestReported` | Farmer |
| `open_dispute` | `record_activity(campaign_id, opener, DisputeInitiated)` | `DisputeInitiated` | Investor / Farmer / Admin |
| `resolve_dispute` | `record_activity(campaign_id, admin, DisputeResolved)` | `DisputeResolved` | Admin |
| `settle_campaign` | `record_activity(campaign_id, farmer, CampaignSettled)` | `CampaignSettled` | Farmer |
| `claim_refund` | `record_activity(campaign_id, investor, CampaignStatusChanged)` | `CampaignStatusChanged` | Investor |

> **Prerequisite:** The `ProductionEscrowContract` address must be `approve_contract`'d in the `RegistryContract` so that activity recording can proceed without requiring per-transaction user authorization inside the registry.

## Event Indexing Responsibilities

Backend indexers should consume events from **both** contracts. The recommended approach is:

1. **Reconstruct financial state** from `ProductionEscrowContract` events.
2. **Verify audit trail** against `RegistryContract` events (and/or on-chain `get_campaign_activities`).
3. **Track access-control changes** from `RegistryContract` events.

### ProductionEscrowContract Events

Events are listed in lifecycle order. Topics are the first argument to `env.events().publish()`; the payload is the second.

| Event Symbol | Topics | Payload | When to Index |
|--------------|--------|---------|---------------|
| `CampaignCreated` | `("CampaignCreated", campaign_id)` | `(farmer, timestamp, target_amount)` | New campaign available for funding. |
| `ContribReceived` | `("ContribReceived", campaign_id)` | `(investor, timestamp, amount)` | Update total funded amount and investor position. |
| `CampaignFunded` | `("CampaignFunded", campaign_id)` | `(timestamp, total_funded)` | Campaign moves to `Funded`; funding target reached. |
| `TranchesConfigured` | `("TranchesConfigured", campaign_id)` | `(timestamp, tranche_count)` | Admin has set the tranche schedule for a funded campaign. |
| `TrancheReleased` | `("TrancheReleased", campaign_id)` | `(recipient, timestamp, amount)` | Escrow balance decreases; farmer received funds. First call transitions status to `InProduction`. |
| `HarvestReported` | `("HarvestReported", campaign_id)` | `(farmer, outcome, timestamp)` | Harvest milestone reached; `outcome` is the reported harvest symbol. |
| `CampaignFailed` | `("CampaignFailed", campaign_id)` | `(timestamp, refundable)` | Campaign marked `Failed`; `refundable` is the total amount available for investor refunds. |
| `DisputeOpened` | `("DisputeOpened", campaign_id)` | `(opener, reason, timestamp, ledger_sequence)` | Campaign status locked to `Disputed`. |
| `DisputeResolved` | `("DisputeResolved", campaign_id)` | `(admin, resolution, payout_to_farmer, refundable_to_investors, timestamp, ledger_sequence)` | Campaign status moves to `Resolved`. |
| `RefundClaimed` | `("RefundClaimed", campaign_id)` | `(investor, timestamp, amount)` | Individual investor refunded from a `Failed` or `Resolved` campaign; zero out their contribution. |
| `ReturnClaimed` | `("ReturnClaimed", campaign_id)` | `(investor, timestamp, amount)` | Individual investor claimed their pro-rata share of returns from a `Settled` campaign. |
| `CampaignSettled` | `("CampaignSettled", campaign_id)` | `(farmer, timestamp, farmer_payout, investor_returns)` | Campaign moves to `Settled`; `farmer_payout` is the amount released to the farmer, `investor_returns` is the pool available to investors. |

### RegistryContract Events

The registry emits events from two layers: **direct calls** (e.g. `initialize`, `approve_contract`) and **activity indexing** (secondary events emitted inside `record_activity` for specific `ActivityAction` variants). Both layers are listed below.

| Event Symbol | Topics | Payload | When to Index |
|--------------|--------|---------|---------------|
| `AdminInitialized` | `("AdminInitialized", admin)` | `(admin, timestamp, ledger_sequence)` | Registry deployed and admin set for the first time. |
| `AdminUpdated` | `("AdminUpdated", new_admin)` | `(actor, old_admin, new_admin, timestamp, ledger_sequence)` | Registry admin address changed. |
| `ContractApproved` | `("ContractApproved", contract)` | `(actor, contract, timestamp, ledger_sequence)` | A contract address was added to the approved-contract allowlist. |
| `ContractRevoked` | `("ContractRevoked", contract)` | `(actor, contract, timestamp, ledger_sequence)` | A contract address was removed from the approved-contract allowlist. |
| `FarmerRegistered` | `("FarmerRegistered", farmer)` | `(farmer, name, timestamp, ledger_sequence)` | A farmer profile was registered directly via `register_farmer`. Also emitted inside `record_activity` when `action_type = FarmerRegistered`. |
| `CampaignRegistered` | `("CampaignRegistered", campaign_id)` | `(farmer, title, timestamp, ledger_sequence)` | A campaign was registered via `register_campaign`. Also emitted inside `record_activity` when `action_type` is `CampaignCreated` or `CampaignRegistered`. |
| `CampaignEscrowLinked` | `("CampaignEscrowLinked", campaign_id)` | `(farmer, escrow_contract, timestamp, ledger_sequence)` | A campaign was linked to its `ProductionEscrowContract` instance via `link_campaign_escrow`. |
| `CampaignStatusUpdated` | `("CampaignStatusUpdated", campaign_id)` | `(prev_status, new_status, timestamp, ledger_sequence)` | Campaign lifecycle status updated via `update_campaign_status`. Also emitted inside `record_activity` when `action_type = CampaignStatusChanged`. |
| `ActivityRecorded` | `("ActivityRecorded", campaign_id)` | `(actor, action_type, timestamp, ledger_sequence)` | Every call to `record_activity` emits this event. Use it as the primary audit feed. |

## Example Transaction Flows

### 1. Campaign Creation

```text
Farmer
  |
  |--(1)--> ProductionEscrowContract::create_campaign(
  |            campaign_id, farmer, target_amount,
  |            token_address, deadline, harvest_metadata
  |         )
  |
  |        [Escrow stores Campaign { status: Active }]
  |        [Escrow emits CampaignCreated event]
  |
  |--(2)--> RegistryContract::record_activity(
  |            campaign_id, farmer, ActivityAction::CampaignCreated
  |         )
  |
  |        [Registry appends ActivityRecord]
  |        [Registry emits ActivityRecorded event]
```

### 2. Funding

```text
Investor 1
  |
  |--(1a)--> ProductionEscrowContract::fund_campaign(
  |             campaign_id, investor1, 600
  |          )
  |          [Investor authorizes token transfer into escrow]
  |          [Escrow updates total_funded & contribution]
  |          [Escrow emits ContribReceived]

Investor 2
  |
  |--(1b)--> ProductionEscrowContract::fund_campaign(
  |             campaign_id, investor2, 400
  |          )
  |          [Investor authorizes token transfer into escrow]
  |          [Escrow updates total_funded & contribution]
  |          [Escrow reaches target and sets status = Funded]
  |          [Escrow emits ContribReceived]
  |          [Escrow emits CampaignFunded]

Backend / Indexer
  |
  |--(2)--> RegistryContract::record_activity(
  |            campaign_id, farmer, ActivityAction::CampaignFunded
  |         )
```

For externally settled funding that has already been verified off-chain, an admin may call
`receive_contribution` to reconcile each investor's contribution without moving tokens. The
admin may then call `complete_funding(campaign_id, total_funded)` only when `total_funded`
equals the campaign's stored `total_funded` and the stored total has reached the target.

### 3. Settlement (Happy Path)

```text
Farmer
  |
  |--(1)--> ProductionEscrowContract::report_harvest(campaign_id, farmer)
  |         [Escrow emits HarvestReported]
  |
  |--(2)--> RegistryContract::record_activity(
  |            campaign_id, farmer, ActivityAction::HarvestReported
  |         )
  |
  |--(3)--> ProductionEscrowContract::settle_campaign(
  |            campaign_id, farmer, final_amount=1000
  |         )
  |         [Escrow sets status = Settled, released += 1000]
  |         [Escrow emits CampaignSettled]
  |
  |--(4)--> RegistryContract::record_activity(
  |            campaign_id, farmer, ActivityAction::CampaignSettled
  |         )
```

### 4. Dispute Resolution → Refund

```text
Investor 1
  |
  |--(1)--> ProductionEscrowContract::open_dispute(
  |            campaign_id, investor1, reason="Delay"
  |         )
  |         [Escrow sets status = Disputed]
  |         [Escrow emits DisputeOpened]
  |
  |--(2)--> RegistryContract::record_activity(
  |            campaign_id, investor1, ActivityAction::DisputeInitiated
  |         )

Admin
  |
  |--(3)--> ProductionEscrowContract::resolve_dispute(
  |            campaign_id, PartialSettlement, payout_amount=300
  |         )
  |         [Escrow sets status = Resolved]
  |         [released = 300, refundable = 700]
  |         [Escrow emits DisputeResolved]
  |
  |--(4)--> RegistryContract::record_activity(
  |            campaign_id, admin, ActivityAction::DisputeResolved
  |         )

Investor 1
  |
  |--(5a)--> ProductionEscrowContract::claim_refund(campaign_id, investor1)
  |          [Pro-rata share: 600 * 700 / 1000 = 420]
  |          [Escrow zeros contribution; emits RefundClaimed]

Investor 2
  |
  |--(5b)--> ProductionEscrowContract::claim_refund(campaign_id, investor2)
  |          [Pro-rata share: 400 * 700 / 1000 = 280]
  |          [Escrow zeros contribution; emits RefundClaimed]
```

## Public Method Reference

### ProductionEscrowContract

- `initialize(env: Env, admin: Address)`
- `create_campaign(env: Env, campaign_id: u64, farmer: Address, target_amount: i128, token_address: Address, deadline: u64, harvest_metadata: Symbol)`
- `fund_campaign(env: Env, campaign_id: u64, investor: Address, amount: i128)`
- `receive_contribution(env: Env, campaign_id: u64, investor: Address, amount: i128)` - admin-only reconciliation for off-chain verified funds
- `complete_funding(env: Env, campaign_id: u64, total_funded: i128)` - admin-only transition that verifies the stored total has reached the target
- `release_tranche(env: Env, campaign_id: u64, recipient: Address, amount: i128)`
- `report_harvest(env: Env, campaign_id: u64, farmer: Address)`
- `open_dispute(env: Env, campaign_id: u64, opener: Address, reason: Symbol)`
- `resolve_dispute(env: Env, campaign_id: u64, resolution: DisputeResolution, payout_amount: i128)`
- `claim_refund(env: Env, campaign_id: u64, investor: Address)`
- `settle_campaign(env: Env, campaign_id: u64, farmer: Address, final_amount: i128)`
- `get_campaign(env: Env, campaign_id: u64) -> Campaign`
- `get_dispute(env: Env, campaign_id: u64) -> Dispute`

### RegistryContract

- `initialize(env: Env, admin: Address)`
- `update_admin(env: Env, new_admin: Address)`
- `get_admin(env: Env) -> Address`
- `approve_contract(env: Env, contract: Address)`
- `revoke_contract(env: Env, contract: Address)`
- `is_contract_approved(env: Env, contract: Address) -> bool`
- `record_activity(env: Env, campaign_id: u64, actor: Address, action_type: ActivityAction)`
- `get_campaign_activities(env: Env, campaign_id: u64) -> Vec<ActivityRecord>`

## Acceptance Criteria Checklist

- [x] Integration documentation covers the expected call flow between contracts.
- [x] Each piece of state is assigned to a contract owner.
- [x] Event indexing responsibilities are documented for both contracts.
- [x] Lifecycle diagram and ordered lifecycle list are included.
- [x] Example transaction flows provided for campaign creation, funding, settlement, refund, and dispute resolution.
- [x] Documented lifecycle matches `Funding -> Funded -> InProduction -> Harvested -> Settled`, with `Failed` and `Disputed` alternatives.
- [x] Public method names match the interfaces defined in the contract source code.
- [x] Backend indexer consumption patterns are clarified.
