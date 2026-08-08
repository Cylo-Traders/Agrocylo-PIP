//! End-to-end contract tests covering the full campaign lifecycle across
//! `ProductionEscrowContract` and `RegistryContract`.
//!
//! With `set_registry` + `approve_contract`, escrow lifecycle methods call
//! into the registry on-chain (`record_activity`, `link_campaign_escrow`,
//! `update_campaign_status`). These tests assert both contracts agree without
//! an off-chain orchestrator replaying activity.
//!
//! Three flows are covered, matching the campaign lifecycle described in the
//! project README:
//!   - Happy path:    FUNDING -> FUNDED -> IN_PRODUCTION (Harvested) -> SETTLED
//!   - Failed path:   FUNDING -> FAILED -> investor refund
//!   - Disputed path: FUNDING -> FUNDED -> DISPUTED -> RESOLVED -> investor refund
//!
//! See the crate `README.md` for instructions on running this suite.

use production_escrow::{
    Campaign, CampaignStatus, DisputeResolution, ProductionEscrowContract,
    ProductionEscrowContractClient,
};
use registry::{ActivityAction, CampaignStatus as RegistryStatus, RegistryContract, RegistryContractClient};
use soroban_sdk::{
    testutils::{Address as _, Events},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, TryFromVal, Symbol,
};

// ─── shared harness ──────────────────────────────────────────────────────

/// Bundles both contract clients plus the actors used across every test, so
/// each test only has to describe the lifecycle steps it cares about.
struct Harness<'a> {
    env: Env,
    escrow: ProductionEscrowContractClient<'a>,
    registry: RegistryContractClient<'a>,
    admin: Address,
    farmer: Address,
    investor1: Address,
    investor2: Address,
    token: Address,
    campaign_id: u64,
}

impl<'a> Harness<'a> {
    /// Deploys both contracts, approves escrow on the registry, points escrow
    /// at the registry via `set_registry`, and creates one campaign (target 1_000).
    /// Registry activity/status for create is filled **by the escrow contract**.
    fn new() -> Self {
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
        sac.mint(&investor1, &600i128);
        sac.mint(&investor2, &400i128);

        registry.initialize(&admin);
        registry.approve_contract(&escrow_id);

        escrow.initialize(&admin);
        escrow.set_registry(&registry_id);

        let campaign_id = 1u64;
        let deadline = 1_000_000u64;
        let harvest_metadata = Symbol::new(&env, "maize");

        escrow.create_campaign(
            &campaign_id,
            &farmer,
            &1000i128,
            &token,
            &deadline,
            &harvest_metadata,
        );

        Harness {
            env,
            escrow,
            registry,
            admin,
            farmer,
            investor1,
            investor2,
            token,
            campaign_id,
        }
    }

    fn campaign(&self) -> Campaign {
        self.escrow.get_campaign(&self.campaign_id)
    }

    fn token_client(&self) -> TokenClient<'a> {
        TokenClient::new(&self.env, &self.token)
    }

    /// Funds fully via escrow only; registry is updated on-chain by fund_campaign.
    fn fund_fully(&self) {
        self.escrow
            .fund_campaign(&self.campaign_id, &self.investor1, &600i128);
        self.escrow
            .fund_campaign(&self.campaign_id, &self.investor2, &400i128);
    }

    fn activity_count(&self) -> u32 {
        self.registry
            .get_campaign_activities(&self.campaign_id)
            .len()
    }

    fn registry_status(&self) -> RegistryStatus {
        self.registry
            .get_campaign_record(&self.campaign_id)
            .status
    }
}

// ─── happy path ──────────────────────────────────────────────────────────

#[test]
fn happy_path_full_lifecycle_settlement() {
    let h = Harness::new();
    assert_eq!(h.registry_status(), RegistryStatus::Active);

    // FUNDING -> FUNDED
    h.fund_fully();
    assert_eq!(h.campaign().status, CampaignStatus::Funded);
    assert_eq!(h.registry_status(), RegistryStatus::Funded);

    // Configure tranches and release one to transition to InProduction
    let mut tranches = soroban_sdk::Vec::new(&h.env);
    tranches.push_back(production_escrow::Tranche {
        amount: 200,
        milestone: Symbol::new(&h.env, "milestone"),
        released: false,
    });
    tranches.push_back(production_escrow::Tranche {
        amount: 800,
        milestone: Symbol::new(&h.env, "harvest"),
        released: false,
    });
    h.escrow.configure_tranches(&h.campaign_id, &tranches);
    h.escrow.release_tranche(&h.campaign_id, &h.farmer, &200i128);
    assert_eq!(h.campaign().status, CampaignStatus::InProduction);
    assert_eq!(h.registry_status(), RegistryStatus::InProduction);

    // IN_PRODUCTION: farmer reports harvest -> Harvested
    let outcome = Symbol::new(&h.env, "good_yield");
    h.escrow
        .report_harvest(&h.campaign_id, &h.farmer, &outcome);
    assert_eq!(h.campaign().status, CampaignStatus::Harvested);
    assert_eq!(h.registry_status(), RegistryStatus::Harvested);

    // SETTLED: admin settles, farmer gets 500, investors share 300 pro-rata.
    let farmer_balance_before = h.token_client().balance(&h.farmer);
    h.escrow
        .settle_campaign(&h.campaign_id, &h.farmer, &500i128);

    let campaign = h.campaign();
    assert_eq!(campaign.status, CampaignStatus::Settled);
    assert_eq!(h.registry_status(), RegistryStatus::Settled);
    assert_eq!(campaign.released, 700); // 200 tranche + 500 settlement payout
    assert_eq!(campaign.returnable, 300);
    assert_eq!(
        h.token_client().balance(&h.farmer),
        farmer_balance_before + 500
    );

    h.escrow.claim_return(&h.campaign_id, &h.investor1);
    h.escrow.claim_return(&h.campaign_id, &h.investor2);
    assert_eq!(h.token_client().balance(&h.investor1), 180);
    assert_eq!(h.token_client().balance(&h.investor2), 120);

    // created, funded x2, funds released, harvest, settled
    let activities = h.registry.get_campaign_activities(&h.campaign_id);
    assert_eq!(activities.len(), 6);
    assert_eq!(activities.get(0).unwrap().action_type, ActivityAction::CampaignCreated);
    assert_eq!(
        activities.get(4).unwrap().action_type,
        ActivityAction::HarvestReported
    );
    assert_eq!(
        activities.get(5).unwrap().action_type,
        ActivityAction::CampaignSettled
    );

    assert!(escrow_emitted(&h, "CampaignSettled"));
    assert!(escrow_emitted(&h, "HarvestReported"));
    assert!(registry_emitted(&h, "ActivityRecorded"));
}

// ─── failed campaign refund flow ────────────────────────────────────────

#[test]
fn failed_campaign_refund_flow() {
    let h = Harness::new();

    h.escrow
        .fund_campaign(&h.campaign_id, &h.investor1, &600i128);
    assert_eq!(h.campaign().status, CampaignStatus::Funding);
    assert_eq!(h.registry_status(), RegistryStatus::Funding);

    h.escrow.mark_failed(&h.campaign_id);

    let campaign = h.campaign();
    assert_eq!(campaign.status, CampaignStatus::Failed);
    assert_eq!(h.registry_status(), RegistryStatus::Failed);
    assert_eq!(campaign.refundable, 600);

    let balance_before = h.token_client().balance(&h.investor1);
    h.escrow.claim_refund(&h.campaign_id, &h.investor1);
    assert_eq!(h.token_client().balance(&h.investor1), balance_before + 600);

    let activities = h.registry.get_campaign_activities(&h.campaign_id);
    assert_eq!(activities.len(), 3); // created, funded, status-changed(failed)
    assert_eq!(
        activities.get(2).unwrap().action_type,
        ActivityAction::CampaignStatusChanged
    );

    assert!(escrow_emitted(&h, "CampaignFailed"));
    assert!(escrow_emitted(&h, "RefundClaimed"));
}

// ─── disputed campaign resolution flow ──────────────────────────────────

#[test]
fn disputed_campaign_partial_settlement_flow() {
    let h = Harness::new();

    h.fund_fully();
    assert_eq!(h.campaign().status, CampaignStatus::Funded);

    let reason = Symbol::new(&h.env, "delay");
    h.escrow
        .open_dispute(&h.campaign_id, &h.investor1, &reason);
    assert_eq!(h.campaign().status, CampaignStatus::Disputed);
    assert_eq!(h.registry_status(), RegistryStatus::Disputed);

    h.escrow.resolve_dispute(
        &h.campaign_id,
        &DisputeResolution::PartialSettlement,
        &400i128,
    );

    let campaign = h.campaign();
    assert_eq!(campaign.status, CampaignStatus::Resolved);
    assert_eq!(h.registry_status(), RegistryStatus::Resolved);
    assert_eq!(campaign.released, 400);
    assert_eq!(campaign.refundable, 600);

    let dispute = h.escrow.get_dispute(&h.campaign_id);
    assert_eq!(dispute.resolution, DisputeResolution::PartialSettlement);

    h.escrow.claim_refund(&h.campaign_id, &h.investor1);
    h.escrow.claim_refund(&h.campaign_id, &h.investor2);
    assert_eq!(h.token_client().balance(&h.investor1), 360);
    assert_eq!(h.token_client().balance(&h.investor2), 240);

    // created, funded x2, dispute-initiated, dispute-resolved
    let activities = h.registry.get_campaign_activities(&h.campaign_id);
    assert_eq!(activities.len(), 5);
    assert_eq!(
        activities.get(3).unwrap().action_type,
        ActivityAction::DisputeInitiated
    );
    assert_eq!(
        activities.get(4).unwrap().action_type,
        ActivityAction::DisputeResolved
    );

    assert!(escrow_emitted(&h, "DisputeOpened"));
    assert!(escrow_emitted(&h, "DisputeResolved"));
    assert!(registry_emitted(&h, "ActivityRecorded"));
}

// ─── registry/escrow consistency across the whole lifecycle ────────────

#[test]
fn registry_activity_log_tracks_every_escrow_transition() {
    let h = Harness::new();
    assert_eq!(h.activity_count(), 1); // CampaignCreated from create_campaign

    h.fund_fully();
    assert_eq!(h.activity_count(), 3); // + funded x2

    let outcome = Symbol::new(&h.env, "average_yield");
    h.escrow
        .report_harvest(&h.campaign_id, &h.farmer, &outcome);
    assert_eq!(h.activity_count(), 4);
    assert_eq!(h.registry_status(), RegistryStatus::Harvested);

    h.escrow
        .settle_campaign(&h.campaign_id, &h.farmer, &1000i128);
    assert_eq!(h.activity_count(), 5);
    assert_eq!(h.campaign().status, CampaignStatus::Settled);
    assert_eq!(h.registry_status(), RegistryStatus::Settled);
}

/// Escrow with a configured registry but without `approve_contract` fails with
/// a documented panic when it tries to sync after a lifecycle change.
#[test]
#[should_panic(expected = "escrow not approved in registry")]
fn escrow_not_approved_in_registry_fails_predictably() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = env.register_contract(None, ProductionEscrowContract);
    let escrow = ProductionEscrowContractClient::new(&env, &escrow_id);
    let registry_id = env.register_contract(None, RegistryContract);
    let registry = RegistryContractClient::new(&env, &registry_id);

    let admin = Address::generate(&env);
    let farmer = Address::generate(&env);
    let token_admin = env.register_stellar_asset_contract_v2(admin.clone());
    let token = token_admin.address();

    registry.initialize(&admin);
    // Deliberately skip approve_contract(escrow).
    escrow.initialize(&admin);
    escrow.set_registry(&registry_id);

    escrow.create_campaign(
        &1u64,
        &farmer,
        &1000i128,
        &token,
        &1_000_000u64,
        &Symbol::new(&env, "maize"),
    );
}

// ─── event helpers ───────────────────────────────────────────────────────

/// Returns true if the escrow contract published an event whose first topic
/// matches `topic_name` anywhere in the test's recorded event log.
fn escrow_emitted(h: &Harness, topic_name: &str) -> bool {
    contract_emitted(&h.env, &h.escrow.address, topic_name)
}

/// Returns true if the registry contract published an event whose first
/// topic matches `topic_name`.
fn registry_emitted(h: &Harness, topic_name: &str) -> bool {
    contract_emitted(&h.env, &h.registry.address, topic_name)
}

fn contract_emitted(env: &Env, contract_id: &Address, topic_name: &str) -> bool {
    let expected = Symbol::new(env, topic_name);
    env.events().all().iter().any(|(id, topics, _data)| {
        id == *contract_id
            && topics
                .iter()
                .next()
                .and_then(|t| Symbol::try_from_val(env, &t).ok())
                .map(|s| s == expected)
                .unwrap_or(false)
    })
}
