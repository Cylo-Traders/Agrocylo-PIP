//! End-to-end contract tests covering the full campaign lifecycle across
//! `ProductionEscrowContract` and `RegistryContract`.
//!
//! These tests simulate what an off-chain indexer / orchestrator does in
//! production: it calls escrow lifecycle methods, then mirrors each
//! transition into the registry's activity log via `record_activity`, and
//! the tests assert that both contracts agree on campaign state at every
//! step, and that the expected events were emitted by both contracts.
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
use registry::{ActivityAction, RegistryContract, RegistryContractClient};
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
    /// Deploys both contracts in a fresh Soroban test environment, mints a
    /// test token to two investors, initializes the registry with the
    /// escrow contract pre-approved (so escrow-originated activity can be
    /// recorded without per-call investor/farmer auth), and creates one
    /// campaign with target 1_000.
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

        // Test token (Stellar Asset Contract) used for escrow transfers.
        let token_admin = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_admin.address();
        let sac = StellarAssetClient::new(&env, &token);
        sac.mint(&investor1, &600i128);
        sac.mint(&investor2, &400i128);

        // Wire up the registry: admin-initialize, then approve the escrow
        // contract address itself, mirroring how a real deployment would
        // let the escrow contract (or its trusted indexer) log activity.
        registry.initialize(&admin);
        registry.approve_contract(&escrow_id);

        escrow.initialize(&admin);

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
        registry.record_activity(&campaign_id, &escrow_id, &ActivityAction::CampaignCreated);

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
        self.escrow.get_campaign(&self.campaign_id).unwrap()
    }

    fn token_client(&self) -> TokenClient<'a> {
        TokenClient::new(&self.env, &self.token)
    }

    /// Funds the campaign from both investors and mirrors the activity into
    /// the registry. Drives the campaign to `Funded` since 600 + 400 == 1000.
    fn fund_fully(&self) {
        self.escrow
            .fund_campaign(&self.campaign_id, &self.investor1, &600i128);
        self.registry.record_activity(
            &self.campaign_id,
            &self.investor1,
            &ActivityAction::CampaignFunded,
        );

        self.escrow
            .fund_campaign(&self.campaign_id, &self.investor2, &400i128);
        self.registry.record_activity(
            &self.campaign_id,
            &self.investor2,
            &ActivityAction::CampaignFunded,
        );
    }

    /// Records a `CampaignStatusChanged` entry in the registry mirroring the
    /// escrow's current on-chain status. Used after any escrow transition
    /// that does not already have a more specific `ActivityAction`.
    fn sync_status(&self, actor: &Address) {
        self.registry.record_activity(
            &self.campaign_id,
            actor,
            &ActivityAction::CampaignStatusChanged,
        );
    }

    /// Returns the registry's activity log entry count for the campaign.
    fn activity_count(&self) -> u32 {
        self.registry
            .get_campaign_activities(&self.campaign_id)
            .len()
    }
}

// ─── happy path ──────────────────────────────────────────────────────────

#[test]
fn happy_path_full_lifecycle_settlement() {
    let h = Harness::new();

    // FUNDING -> FUNDED
    h.fund_fully();
    assert_eq!(h.campaign().status, CampaignStatus::Funded);

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

    // IN_PRODUCTION: farmer reports harvest -> Harvested
    let outcome = Symbol::new(&h.env, "good_yield");
    h.escrow
        .report_harvest(&h.campaign_id, &h.farmer, &outcome);
    h.registry.record_activity(
        &h.campaign_id,
        &h.farmer,
        &ActivityAction::HarvestReported,
    );
    assert_eq!(h.campaign().status, CampaignStatus::Harvested);

    // SETTLED: admin settles, farmer gets 500, investors share 300 pro-rata.
    let farmer_balance_before = h.token_client().balance(&h.farmer);
    h.escrow
        .settle_campaign(&h.campaign_id, &h.farmer, &500i128);
    h.registry
        .record_activity(&h.campaign_id, &h.admin, &ActivityAction::CampaignSettled);

    let campaign = h.campaign();
    assert_eq!(campaign.status, CampaignStatus::Settled);
    assert_eq!(campaign.released, 700); // 200 tranche + 500 settlement payout
    assert_eq!(campaign.returnable, 300);
    // release_tranche only updates accounting (campaign.released) and never
    // moves tokens — settle_campaign is the only call in this flow that
    // actually transfers to the farmer, so the on-chain balance only reflects
    // the 500 settlement payout, not the cumulative `released` bookkeeping.
    assert_eq!(
        h.token_client().balance(&h.farmer),
        farmer_balance_before + 500
    );

    // Investors claim their pro-rata returns: 60% / 40% of the 300 returnable.
    h.escrow.claim_return(&h.campaign_id, &h.investor1);
    h.escrow.claim_return(&h.campaign_id, &h.investor2);
    assert_eq!(h.token_client().balance(&h.investor1), 180); // 60% of 300
    assert_eq!(h.token_client().balance(&h.investor2), 120); // 40% of 300

    // Cross-contract consistency: registry saw one entry per lifecycle step.
    let activities = h.registry.get_campaign_activities(&h.campaign_id);
    assert_eq!(activities.len(), 5); // created, funded x2, harvested, settled
    assert_eq!(activities.get(0).unwrap().action_type, ActivityAction::CampaignCreated);
    assert_eq!(
        activities.get(3).unwrap().action_type,
        ActivityAction::HarvestReported
    );
    assert_eq!(
        activities.get(4).unwrap().action_type,
        ActivityAction::CampaignSettled
    );

    // Event assertions on both contracts.
    assert!(escrow_emitted(&h, "CampaignSettled"));
    assert!(escrow_emitted(&h, "HarvestReported"));
    assert!(registry_emitted(&h, "ActivityRecorded"));
}

// ─── failed campaign refund flow ────────────────────────────────────────

#[test]
fn failed_campaign_refund_flow() {
    let h = Harness::new();

    // Partially fund — not enough to reach target.
    h.escrow
        .fund_campaign(&h.campaign_id, &h.investor1, &600i128);
    h.registry.record_activity(
        &h.campaign_id,
        &h.investor1,
        &ActivityAction::CampaignFunded,
    );
    assert_eq!(h.campaign().status, CampaignStatus::Funding);

    // Admin marks the campaign failed — escrowed funds become refundable.
    h.escrow.mark_failed(&h.campaign_id);
    h.sync_status(&h.admin);

    let campaign = h.campaign();
    assert_eq!(campaign.status, CampaignStatus::Failed);
    assert_eq!(campaign.refundable, 600);

    // Investor claims their full refund (sole contributor).
    let balance_before = h.token_client().balance(&h.investor1);
    h.escrow.claim_refund(&h.campaign_id, &h.investor1);
    assert_eq!(h.token_client().balance(&h.investor1), balance_before + 600);

    // Registry mirrors the terminal state.
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

    // Investor disputes the campaign before harvest.
    let reason = Symbol::new(&h.env, "delay");
    h.escrow
        .open_dispute(&h.campaign_id, &h.investor1, &reason);
    h.registry.record_activity(
        &h.campaign_id,
        &h.investor1,
        &ActivityAction::DisputeInitiated,
    );
    assert_eq!(h.campaign().status, CampaignStatus::Disputed);

    // Admin resolves with a partial settlement: 400 to farmer, 600 refundable.
    h.escrow.resolve_dispute(
        &h.campaign_id,
        &DisputeResolution::PartialSettlement,
        &400i128,
    );
    h.registry
        .record_activity(&h.campaign_id, &h.admin, &ActivityAction::DisputeResolved);

    let campaign = h.campaign();
    assert_eq!(campaign.status, CampaignStatus::Resolved);
    assert_eq!(campaign.released, 400);
    assert_eq!(campaign.refundable, 600);

    let dispute = h.escrow.get_dispute(&h.campaign_id).unwrap();
    assert_eq!(dispute.resolution, DisputeResolution::PartialSettlement);

    // Investors claim their pro-rata share of the 600 refundable pool.
    h.escrow.claim_refund(&h.campaign_id, &h.investor1);
    h.escrow.claim_refund(&h.campaign_id, &h.investor2);
    assert_eq!(h.token_client().balance(&h.investor1), 360); // 60% of 600
    assert_eq!(h.token_client().balance(&h.investor2), 240); // 40% of 600

    // Registry: created, funded x2, dispute-initiated, dispute-resolved.
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
    assert_eq!(h.activity_count(), 1); // CampaignCreated from setup

    h.fund_fully();
    assert_eq!(h.activity_count(), 3); // + funded x2

    let outcome = Symbol::new(&h.env, "average_yield");
    h.escrow
        .report_harvest(&h.campaign_id, &h.farmer, &outcome);
    h.registry.record_activity(
        &h.campaign_id,
        &h.farmer,
        &ActivityAction::HarvestReported,
    );
    assert_eq!(h.activity_count(), 4);

    h.escrow
        .settle_campaign(&h.campaign_id, &h.farmer, &1000i128);
    h.registry
        .record_activity(&h.campaign_id, &h.admin, &ActivityAction::CampaignSettled);
    assert_eq!(h.activity_count(), 5);
    assert_eq!(h.campaign().status, CampaignStatus::Settled);
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
