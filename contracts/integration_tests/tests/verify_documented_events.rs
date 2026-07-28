//! Ensures that every event symbol referenced in INTEGRATION.md is actually
//! emitted by the corresponding contract during a realistic lifecycle run.
//!
//! **How it works**
//!
//! Rather than parsing INTEGRATION.md at runtime (which is fragile), this test
//! exhaustively exercises each documented event trigger and then asserts that
//! the event was observed in the Soroban test harness's event log.  If an
//! event symbol ever changes in `events.rs` but the documentation is not
//! updated (or vice-versa), one of the assertions below will fail with a clear
//! message naming the missing symbol.
//!
//! Covered escrow events (from INTEGRATION.md §ProductionEscrowContract Events):
//!   CampaignCreated, ContribReceived, CampaignFunded, TranchesConfigured,
//!   TrancheReleased, HarvestReported, CampaignFailed, DisputeOpened,
//!   DisputeResolved, RefundClaimed, ReturnClaimed, CampaignSettled
//!
//! Covered registry events (from INTEGRATION.md §RegistryContract Events):
//!   AdminInitialized, ContractApproved, ContractRevoked, AdminUpdated,
//!   FarmerRegistered, CampaignRegistered, CampaignEscrowLinked,
//!   CampaignStatusUpdated, ActivityRecorded

use production_escrow::{
    CampaignStatus, DisputeResolution, ProductionEscrowContract, ProductionEscrowContractClient,
};
use registry::{ActivityAction, RegistryContract, RegistryContractClient};
use soroban_sdk::{
    testutils::{Address as _, Events},
    token::StellarAssetClient,
    Address, Env, Symbol, TryFromVal,
};

// ─── helpers ─────────────────────────────────────────────────────────────────

fn assert_event(env: &Env, contract_id: &Address, topic_name: &str) {
    let expected = Symbol::new(env, topic_name);
    let found = env.events().all().iter().any(|(id, topics, _data)| {
        id == *contract_id
            && topics
                .iter()
                .next()
                .and_then(|t| Symbol::try_from_val(env, &t).ok())
                .map(|s| s == expected)
                .unwrap_or(false)
    });
    assert!(
        found,
        "INTEGRATION.md documents event `{topic_name}` but it was NOT emitted by contract \
         {contract_id:?} during this test run.  Either the event symbol in events.rs was \
         renamed/removed, or the triggering code path was not exercised."
    );
}


// ─── ProductionEscrowContract event coverage ─────────────────────────────────

/// Verifies every ProductionEscrowContract event documented in INTEGRATION.md
/// by triggering the corresponding contract call and asserting the symbol was
/// observed in the event log.
#[test]
fn escrow_events_all_documented_symbols_are_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = env.register_contract(None, ProductionEscrowContract);
    let escrow = ProductionEscrowContractClient::new(&env, &escrow_id);

    let registry_id = env.register_contract(None, RegistryContract);
    let registry = RegistryContractClient::new(&env, &registry_id);

    let admin = Address::generate(&env);
    let farmer = Address::generate(&env);
    let investor1 = Address::generate(&env);
    let investor2 = Address::generate(&env);

    let token_admin = env.register_stellar_asset_contract_v2(admin.clone());
    let token = token_admin.address();
    let sac = StellarAssetClient::new(&env, &token);
    sac.mint(&investor1, &2000i128);
    sac.mint(&investor2, &2000i128);

    registry.initialize(&admin);
    registry.approve_contract(&escrow_id);
    escrow.initialize(&admin);

    // ── CampaignCreated ────────────────────────────────────────────────────
    let campaign_id = 1u64;
    escrow.create_campaign(
        &campaign_id,
        &farmer,
        &1000i128,
        &token,
        &1_000_000u64,
        &Symbol::new(&env, "maize"),
    );
    assert_event(&env, &escrow_id, "CampaignCreated");

    // ── ContribReceived ────────────────────────────────────────────────────
    escrow.fund_campaign(&campaign_id, &investor1, &600i128);
    assert_event(&env, &escrow_id, "ContribReceived");

    // ── CampaignFunded ─────────────────────────────────────────────────────
    escrow.fund_campaign(&campaign_id, &investor2, &400i128);
    assert_event(&env, &escrow_id, "CampaignFunded");

    // ── TranchesConfigured ────────────────────────────────────────────────
    escrow.configure_tranches(
        &campaign_id,
        &soroban_sdk::vec![
            &env,
            production_escrow::Tranche {
                amount: 500i128,
                milestone: Symbol::new(&env, "planting"),
                released: false,
            },
            production_escrow::Tranche {
                amount: 500i128,
                milestone: Symbol::new(&env, "harvest"),
                released: false,
            },
        ],
    );
    assert_event(&env, &escrow_id, "TranchesConfigured");

    // ── TrancheReleased ───────────────────────────────────────────────────
    escrow.release_tranche(&campaign_id, &farmer, &500i128);
    assert_event(&env, &escrow_id, "TrancheReleased");

    // ── HarvestReported ───────────────────────────────────────────────────
    let outcome = Symbol::new(&env, "good");
    escrow.report_harvest(&campaign_id, &farmer, &outcome);
    assert_event(&env, &escrow_id, "HarvestReported");

    // ── CampaignSettled / ReturnClaimed ──────────────────────────────────
    // Use a second campaign so we can also exercise CampaignFailed and
    // the dispute path in separate campaigns below.
    let settled_campaign = 2u64;
    escrow.create_campaign(
        &settled_campaign,
        &farmer,
        &1000i128,
        &token,
        &1_000_000u64,
        &Symbol::new(&env, "wheat"),
    );
    escrow.fund_campaign(&settled_campaign, &investor1, &600i128);
    escrow.fund_campaign(&settled_campaign, &investor2, &400i128);
    let outcome2 = Symbol::new(&env, "good");
    escrow.report_harvest(&settled_campaign, &farmer, &outcome2);
    escrow.settle_campaign(&settled_campaign, &farmer, &800i128);
    assert_event(&env, &escrow_id, "CampaignSettled");

    // investor claims return from settled campaign
    escrow.claim_return(&settled_campaign, &investor1);
    assert_event(&env, &escrow_id, "ReturnClaimed");

    // ── CampaignFailed ────────────────────────────────────────────────────
    let failed_campaign = 3u64;
    escrow.create_campaign(
        &failed_campaign,
        &farmer,
        &1000i128,
        &token,
        &1_000_000u64,
        &Symbol::new(&env, "rice"),
    );
    escrow.fund_campaign(&failed_campaign, &investor1, &300i128);
    escrow.mark_failed(&failed_campaign);
    assert_event(&env, &escrow_id, "CampaignFailed");

    // ── RefundClaimed ─────────────────────────────────────────────────────
    escrow.claim_refund(&failed_campaign, &investor1);
    assert_event(&env, &escrow_id, "RefundClaimed");

    // ── DisputeOpened / DisputeResolved ───────────────────────────────────
    let disputed_campaign = 4u64;
    escrow.create_campaign(
        &disputed_campaign,
        &farmer,
        &1000i128,
        &token,
        &1_000_000u64,
        &Symbol::new(&env, "soy"),
    );
    escrow.fund_campaign(&disputed_campaign, &investor2, &400i128);
    escrow.fund_campaign(&disputed_campaign, &investor1, &600i128);
    escrow.open_dispute(
        &disputed_campaign,
        &investor1,
        &Symbol::new(&env, "delay"),
    );
    assert_event(&env, &escrow_id, "DisputeOpened");

    escrow.resolve_dispute(
        &disputed_campaign,
        &DisputeResolution::PartialSettlement,
        &300i128,
    );
    assert_event(&env, &escrow_id, "DisputeResolved");
}

// ─── RegistryContract event coverage ─────────────────────────────────────────

/// Verifies every RegistryContract event documented in INTEGRATION.md by
/// triggering the corresponding contract call and asserting the symbol was
/// observed in the event log.
#[test]
fn registry_events_all_documented_symbols_are_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let registry_id = env.register_contract(None, RegistryContract);
    let registry = RegistryContractClient::new(&env, &registry_id);

    let escrow_id = env.register_contract(None, ProductionEscrowContract);
    // escrow_id is only used to be linked and approved, not to call escrow methods.

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let farmer = Address::generate(&env);

    // ── AdminInitialized ──────────────────────────────────────────────────
    registry.initialize(&admin);
    assert_event(&env, &registry_id, "AdminInitialized");

    // ── ContractApproved ──────────────────────────────────────────────────
    registry.approve_contract(&escrow_id);
    assert_event(&env, &registry_id, "ContractApproved");

    // ── ContractRevoked ───────────────────────────────────────────────────
    // Approve a throwaway address then revoke it so the allowlist is not left empty.
    let throwaway = Address::generate(&env);
    registry.approve_contract(&throwaway);
    registry.revoke_contract(&throwaway);
    assert_event(&env, &registry_id, "ContractRevoked");

    // ── AdminUpdated ──────────────────────────────────────────────────────
    registry.update_admin(&new_admin);
    assert_event(&env, &registry_id, "AdminUpdated");

    // ── FarmerRegistered ──────────────────────────────────────────────────
    registry.register_farmer(
        &farmer,
        &soroban_sdk::String::from_str(&env, "Alice"),
        &soroban_sdk::String::from_str(&env, "Nairobi"),
    );
    assert_event(&env, &registry_id, "FarmerRegistered");

    // ── CampaignRegistered ────────────────────────────────────────────────
    let campaign_id = 1u64;
    registry.register_campaign(
        &campaign_id,
        &farmer,
        &soroban_sdk::String::from_str(&env, "Maize 2026"),
        &soroban_sdk::String::from_str(&env, "Seasonal crop"),
    );
    assert_event(&env, &registry_id, "CampaignRegistered");

    // ── CampaignEscrowLinked ──────────────────────────────────────────────
    registry.link_campaign_escrow(
        &campaign_id,
        &farmer,
        &escrow_id,
        &Symbol::new(&env, "maize"),
        &Symbol::new(&env, "rift"),
    );
    assert_event(&env, &registry_id, "CampaignEscrowLinked");

    // ── CampaignStatusUpdated ─────────────────────────────────────────────
    // escrow_id is the registered escrow for this campaign (set via link_campaign_escrow)
    // and is therefore authorized as the caller.  admin was transferred to new_admin above.
    registry.update_campaign_status(
        &campaign_id,
        &escrow_id,
        &registry::CampaignStatus::Funded,
    );
    assert_event(&env, &registry_id, "CampaignStatusUpdated");

    // ── ActivityRecorded ──────────────────────────────────────────────────
    // record_activity always emits ActivityRecorded regardless of action type.
    registry.record_activity(
        &campaign_id,
        &farmer,
        &ActivityAction::HarvestReported,
    );
    assert_event(&env, &registry_id, "ActivityRecorded");
}
