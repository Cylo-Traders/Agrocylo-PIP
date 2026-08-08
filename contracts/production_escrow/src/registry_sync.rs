//! Optional on-chain sync from ProductionEscrow → RegistryContract.
//!
//! When a registry address is configured via `set_registry`, lifecycle
//! transitions notify the registry with `record_activity` and (when a
//! campaign record is linked) `update_campaign_status`.
//!
//! **Failure policy (fail-closed):** if a registry is configured and a sync
//! call panics (e.g. escrow not `approve_contract`'d), the whole escrow
//! invocation aborts and rolls back. If no registry is configured, sync is
//! a no-op so existing deployments and unit tests keep working.

use crate::storage;
use crate::types::CampaignStatus as EscrowStatus;
use registry::{
    ActivityAction, CampaignStatus as RegistryStatus, RegistryContractClient,
};
use soroban_sdk::{Address, Env, Symbol};

fn map_status(status: &EscrowStatus) -> RegistryStatus {
    match status {
        EscrowStatus::Active => RegistryStatus::Active,
        EscrowStatus::Funding => RegistryStatus::Funding,
        EscrowStatus::Funded => RegistryStatus::Funded,
        EscrowStatus::InProduction => RegistryStatus::InProduction,
        EscrowStatus::Harvested => RegistryStatus::Harvested,
        EscrowStatus::Disputed => RegistryStatus::Disputed,
        EscrowStatus::Resolved => RegistryStatus::Resolved,
        EscrowStatus::Settled => RegistryStatus::Settled,
        EscrowStatus::Failed => RegistryStatus::Failed,
    }
}

fn client(env: &Env) -> Option<RegistryContractClient<'_>> {
    storage::get_registry(env).map(|addr| RegistryContractClient::new(env, &addr))
}

/// Ensures this escrow is on the registry allowlist before cross-contract writes
/// that require an approved contract / linked escrow identity.
fn require_escrow_approved(env: &Env, client: &RegistryContractClient) {
    let self_addr = env.current_contract_address();
    if !client.is_contract_approved(&self_addr) {
        panic!(
            "escrow not approved in registry: call RegistryContract::approve_contract first"
        );
    }
}

/// Link the campaign in the registry (idempotent if already linked) and log
/// `CampaignCreated`. Called after a successful `create_campaign`.
pub fn on_campaign_created(
    env: &Env,
    campaign_id: u64,
    farmer: &Address,
    harvest_metadata: &Symbol,
) {
    let Some(client) = client(env) else {
        return;
    };
    require_escrow_approved(env, &client);

    let self_addr = env.current_contract_address();
    // Approved escrow may authorize link_campaign_escrow on the farmer's behalf.
    if !client.has_campaign_record(&campaign_id) {
        let region = Symbol::new(env, "default");
        client.link_campaign_escrow(
            &campaign_id,
            farmer,
            &self_addr,
            harvest_metadata,
            &region,
        );
    }

    client.record_activity(
        &campaign_id,
        &self_addr,
        &ActivityAction::CampaignCreated,
    );
    client.update_campaign_status(
        &campaign_id,
        &self_addr,
        &RegistryStatus::Active,
    );
}

/// Record a contribution / funding event. When the campaign becomes Funded,
/// also mirrors `Funded` status.
pub fn on_contribution(
    env: &Env,
    campaign_id: u64,
    investor: &Address,
    new_status: &EscrowStatus,
) {
    let Some(client) = client(env) else {
        return;
    };
    require_escrow_approved(env, &client);

    // Investor already authorized `fund_campaign`; use them as the activity actor.
    client.record_activity(
        &campaign_id,
        investor,
        &ActivityAction::CampaignFunded,
    );

    if matches!(new_status, EscrowStatus::Funded | EscrowStatus::Funding) {
        let self_addr = env.current_contract_address();
        if client.has_campaign_record(&campaign_id) {
            client.update_campaign_status(
                &campaign_id,
                &self_addr,
                &map_status(new_status),
            );
        }
    }
}

pub fn on_status_transition(
    env: &Env,
    campaign_id: u64,
    actor: &Address,
    action: ActivityAction,
    new_status: &EscrowStatus,
) {
    let Some(client) = client(env) else {
        return;
    };
    require_escrow_approved(env, &client);

    client.record_activity(&campaign_id, actor, &action);

    let self_addr = env.current_contract_address();
    if client.has_campaign_record(&campaign_id) {
        client.update_campaign_status(
            &campaign_id,
            &self_addr,
            &map_status(new_status),
        );
    }
}

pub fn on_funds_released(env: &Env, campaign_id: u64, new_status: &EscrowStatus) {
    let Some(client) = client(env) else {
        return;
    };
    require_escrow_approved(env, &client);

    let self_addr = env.current_contract_address();
    client.record_activity(
        &campaign_id,
        &self_addr,
        &ActivityAction::FundsReleased,
    );
    if client.has_campaign_record(&campaign_id) {
        client.update_campaign_status(
            &campaign_id,
            &self_addr,
            &map_status(new_status),
        );
    }
}
