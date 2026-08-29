use crate::types::{ActivityAction, ActivityRecord, CampaignStatus};
use soroban_sdk::{Address, Env, String, Symbol};

pub const ADMIN_INITIALIZED: &str = "AdminInitialized";
pub const ADMIN_UPDATED: &str = "AdminUpdated";
pub const CONTRACT_APPROVED: &str = "ContractApproved";
pub const CONTRACT_REVOKED: &str = "ContractRevoked";
pub const FARMER_REGISTERED: &str = "FarmerRegistered";
pub const CAMPAIGN_REGISTERED: &str = "CampaignRegistered";
pub const CAMPAIGN_ESCROW_LINKED: &str = "CampaignEscrowLinked";
pub const CAMPAIGN_STATUS_UPDATED: &str = "CampaignStatusUpdated";
pub const CAMPAIGN_STATUS_RECONCILED: &str = "CampaignStatusReconciled";
pub const ACTIVITY_RECORDED: &str = "ActivityRecorded";

// Registry event contract for indexers:
// - AdminInitialized(admin) -> (admin, timestamp, ledger_sequence)
// - AdminUpdated(new_admin) -> (actor, old_admin, new_admin, timestamp, ledger_sequence)
// - ContractApproved(contract) -> (actor, contract, timestamp, ledger_sequence)
// - ContractRevoked(contract) -> (actor, contract, timestamp, ledger_sequence)
// - FarmerRegistered(farmer) -> (farmer, name, timestamp, ledger_sequence)
// - CampaignRegistered(campaign_id) -> (farmer, title, timestamp, ledger_sequence)
// - CampaignEscrowLinked(campaign_id) -> (farmer, escrow_contract, timestamp, ledger_sequence)
// - CampaignStatusUpdated(campaign_id) -> (prev_status, new_status, timestamp, ledger_sequence)
// - ActivityRecorded(campaign_id) -> (actor, action_type, timestamp, ledger_sequence)
//
// FarmerRegistered/CampaignRegistered/CampaignStatusUpdated are also emitted
// by `record_activity` (see emit_activity_index_event below) so indexers see
// one topic per event type regardless of whether it came from a direct call
// or the activity log.

pub fn admin_initialized(env: &Env, admin: Address) {
    env.events().publish(
        (Symbol::new(env, ADMIN_INITIALIZED), admin.clone()),
        (admin, env.ledger().timestamp(), env.ledger().sequence()),
    );
}

pub fn admin_updated(env: &Env, old_admin: Address, new_admin: Address) {
    env.events().publish(
        (Symbol::new(env, ADMIN_UPDATED), new_admin.clone()),
        (
            old_admin.clone(),
            old_admin,
            new_admin,
            env.ledger().timestamp(),
            env.ledger().sequence(),
        ),
    );
}

pub fn contract_approved(env: &Env, actor: Address, contract: Address) {
    env.events().publish(
        (Symbol::new(env, CONTRACT_APPROVED), contract.clone()),
        (
            actor,
            contract,
            env.ledger().timestamp(),
            env.ledger().sequence(),
        ),
    );
}

pub fn contract_revoked(env: &Env, actor: Address, contract: Address) {
    env.events().publish(
        (Symbol::new(env, CONTRACT_REVOKED), contract.clone()),
        (
            actor,
            contract,
            env.ledger().timestamp(),
            env.ledger().sequence(),
        ),
    );
}

pub fn activity_recorded(env: &Env, campaign_id: u64, record: ActivityRecord) {
    emit_activity_index_event(env, campaign_id, &record);

    env.events().publish(
        (Symbol::new(env, ACTIVITY_RECORDED), campaign_id),
        (
            record.actor,
            record.action_type,
            record.timestamp,
            record.ledger_sequence,
        ),
    );
}

pub fn farmer_registered(env: &Env, farmer: Address, name: String) {
    env.events().publish(
        (Symbol::new(env, FARMER_REGISTERED), farmer.clone()),
        (
            farmer,
            name,
            env.ledger().timestamp(),
            env.ledger().sequence(),
        ),
    );
}

pub fn campaign_registered(env: &Env, campaign_id: u64, farmer: Address, title: String) {
    env.events().publish(
        (Symbol::new(env, CAMPAIGN_REGISTERED), campaign_id),
        (
            farmer,
            title,
            env.ledger().timestamp(),
            env.ledger().sequence(),
        ),
    );
}

pub fn campaign_escrow_linked(
    env: &Env,
    campaign_id: u64,
    farmer: Address,
    escrow_contract: Address,
) {
    env.events().publish(
        (Symbol::new(env, CAMPAIGN_ESCROW_LINKED), campaign_id),
        (
            farmer,
            escrow_contract,
            env.ledger().timestamp(),
            env.ledger().sequence(),
        ),
    );
}

pub fn campaign_status_updated(
    env: &Env,
    campaign_id: u64,
    prev_status: CampaignStatus,
    new_status: CampaignStatus,
) {
    env.events().publish(
        (Symbol::new(env, CAMPAIGN_STATUS_UPDATED), campaign_id),
        (
            prev_status,
            new_status,
            env.ledger().timestamp(),
            env.ledger().sequence(),
        ),
    );
}

/// Emitted when `reconcile_campaign_status` finds and corrects drift between
/// the registry's mirrored status and the escrow contract's real on-chain
/// status. Distinct from `CampaignStatusUpdated` (normal orchestrator-driven
/// update) so monitoring can flag drift events separately -- every
/// occurrence means a registry update was missed upstream.
pub fn campaign_status_reconciled(
    env: &Env,
    campaign_id: u64,
    prev_status: CampaignStatus,
    new_status: CampaignStatus,
) {
    env.events().publish(
        (Symbol::new(env, CAMPAIGN_STATUS_RECONCILED), campaign_id),
        (
            prev_status,
            new_status,
            env.ledger().timestamp(),
            env.ledger().sequence(),
        ),
    );
}

fn emit_activity_index_event(env: &Env, campaign_id: u64, record: &ActivityRecord) {
    let payload = (
        record.actor.clone(),
        record.action_type.clone(),
        record.timestamp,
        record.ledger_sequence,
    );

    match &record.action_type {
        ActivityAction::FarmerRegistered => {
            env.events().publish(
                (Symbol::new(env, FARMER_REGISTERED), record.actor.clone()),
                (
                    record.actor.clone(),
                    record.timestamp,
                    record.ledger_sequence,
                ),
            );
        }
        ActivityAction::CampaignCreated | ActivityAction::CampaignRegistered => {
            env.events().publish(
                (Symbol::new(env, CAMPAIGN_REGISTERED), campaign_id),
                payload,
            );
        }
        ActivityAction::CampaignStatusChanged => {
            env.events().publish(
                (Symbol::new(env, CAMPAIGN_STATUS_UPDATED), campaign_id),
                payload,
            );
        }
        _ => {}
    }
}
