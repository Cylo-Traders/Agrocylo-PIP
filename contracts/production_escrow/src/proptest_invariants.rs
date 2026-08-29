// Property-based invariant tests for the production escrow contract.
//
// Run:   cargo test -p production_escrow proptest
// Tune:  PROPTEST_CASES=2000 cargo test -p production_escrow proptest
// Seed:  PROPTEST_SEED=0xDEADBEEF cargo test ...   (reproduce a specific failure)

extern crate std;

use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Env, Symbol};

use super::{DisputeResolution, ProductionEscrowContract};

// ── helpers ──────────────────────────────────────────────────────────────────

/// Divides `total` into `proportions.len()` slots, each > 0, summing exactly
/// to `total`.  Any integer remainder from division goes to the last slot.
fn distribute(proportions: &[u32], total: i64) -> std::vec::Vec<i64> {
    let prop_sum: u64 = proportions.iter().map(|&p| p as u64).sum();
    let mut amounts: std::vec::Vec<i64> = proportions
        .iter()
        .map(|&p| (total as u64 * p as u64 / prop_sum) as i64)
        .collect();
    let assigned: i64 = amounts.iter().sum();
    *amounts.last_mut().unwrap() += total - assigned;
    // Drop any slot that rounded down to zero (only when total < slot count).
    amounts.into_iter().filter(|&x| x > 0).collect()
}

fn create_token<'a>(env: &'a Env, admin: &Address) -> (Address, StellarAssetClient<'a>) {
    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let sac = StellarAssetClient::new(env, &token_id.address());
    (token_id.address(), sac)
}

// ── Scenario 1: Failed campaign — sum(refunds) ≤ refundable ──────────────────
//
// Invariants verified:
//   • sum of all claimed pro-rata shares ≤ campaign.refundable
//   • every contribution slot is zeroed after a successful claim (no double-spend)
//   • a contribution whose pro-rata share rounds down to zero is left intact

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    #[test]
    fn prop_failed_campaign_refunds_bounded(
        target      in 2i64..=100_000i64,
        proportions in prop::collection::vec(1u32..=1000u32, 1..=5_usize),
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProductionEscrowContract);
        let client = super::ProductionEscrowContractClient::new(&env, &contract_id);

        let admin  = Address::generate(&env);
        let farmer = Address::generate(&env);

        let (token_addr, sac) = create_token(&env, &admin);
        // Pre-fund the contract balance so receive_contribution's solvency check passes.
        sac.mint(&contract_id, &(target as i128));

        client.initialize(&admin);
        client.create_campaign(
            &1u64,
            &farmer,
            &(target as i128),
            &token_addr,
            &1_000_000u64,
            &Symbol::new(&env, "harvest"),
        );

        let amounts = distribute(&proportions, target);
        prop_assume!(!amounts.is_empty());

        let investors: std::vec::Vec<Address> =
            amounts.iter().map(|_| Address::generate(&env)).collect();

        for (inv, &amt) in investors.iter().zip(amounts.iter()) {
            client.receive_contribution(&1u64, inv, &(amt as i128));
        }
        client.complete_funding(&1u64, &(target as i128));

        // Mark failed — all held funds (= total_funded here) become refundable.
        client.mark_failed(&1u64);

        let campaign   = client.get_campaign(&1u64).unwrap();
        let refundable = campaign.refundable;

        // Simulate what claim_refund computes, then call it. A share that
        // truncates to zero is not claimable — `claim_refund` panics with
        // "nothing to return" — so those investors are tracked separately.
        let mut total_claimed: i128 = 0;
        let mut claimed: std::vec::Vec<&Address> = std::vec::Vec::new();
        let mut skipped: std::vec::Vec<(&Address, i128)> = std::vec::Vec::new();

        for inv in &investors {
            let contributed = client.get_contribution(&1u64, inv);
            if contributed <= 0 {
                continue;
            }
            let share = contributed * refundable / (target as i128);
            if share > 0 {
                client.claim_refund(&1u64, inv);
                total_claimed += share;
                claimed.push(inv);
            } else {
                skipped.push((inv, contributed));
            }
        }

        // sum(claimed) ≤ refundable (integer truncation may leave dust in contract).
        prop_assert!(
            total_claimed <= refundable,
            "total_claimed={} > refundable={}", total_claimed, refundable
        );

        // Every slot that claimed must now be zeroed (no double-spend).
        for inv in claimed {
            prop_assert_eq!(
                client.get_contribution(&1u64, inv),
                0i128,
                "contribution slot not zeroed after claim_refund"
            );
        }

        // Slots that could not claim must be left exactly as they were.
        for (inv, contributed) in skipped {
            prop_assert_eq!(
                client.get_contribution(&1u64, inv),
                contributed,
                "unclaimable contribution slot must be left untouched"
            );
        }
    }
}

// ── Scenario 2: Settled campaign — sum(returns) ≤ returnable ─────────────────
//
// Invariants verified:
//   • campaign.returnable equals (held − farmer_payout) after settlement
//   • sum of all claimed pro-rata returns ≤ campaign.returnable
//   • every contribution slot is zeroed after a successful claim
//   • a contribution whose pro-rata share rounds down to zero is left intact —
//     `claim_return` panics with "nothing to return" rather than consuming it

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    #[test]
    fn prop_settled_campaign_returns_bounded(
        target      in 2i64..=100_000i64,
        proportions in prop::collection::vec(1u32..=1000u32, 1..=5_usize),
        payout_pct  in 0u32..=100u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProductionEscrowContract);
        let client = super::ProductionEscrowContractClient::new(&env, &contract_id);

        let admin  = Address::generate(&env);
        let farmer = Address::generate(&env);

        let (token_addr, sac) = create_token(&env, &admin);
        sac.mint(&contract_id, &(target as i128));

        client.initialize(&admin);
        client.create_campaign(
            &1u64,
            &farmer,
            &(target as i128),
            &token_addr,
            &1_000_000u64,
            &Symbol::new(&env, "harvest"),
        );

        let amounts = distribute(&proportions, target);
        prop_assume!(!amounts.is_empty());

        let investors: std::vec::Vec<Address> =
            amounts.iter().map(|_| Address::generate(&env)).collect();

        for (inv, &amt) in investors.iter().zip(amounts.iter()) {
            client.receive_contribution(&1u64, inv, &(amt as i128));
        }
        client.complete_funding(&1u64, &(target as i128));

        // Farmer reports harvest, admin settles.
        client.report_harvest(&1u64, &farmer, &Symbol::new(&env, "good"));

        let held: i128          = target as i128; // released=refundable=returnable=0
        let farmer_payout: i128 = (held as u64 * payout_pct as u64 / 100) as i128;
        let expected_returnable = held - farmer_payout;

        client.settle_campaign(&1u64, &farmer, &farmer_payout);

        let campaign   = client.get_campaign(&1u64).unwrap();
        let returnable = campaign.returnable;

        prop_assert_eq!(
            returnable,
            expected_returnable,
            "returnable mismatch: got {} expected {}", returnable, expected_returnable
        );

        if returnable == 0 {
            return Ok(());
        }

        let mut total_claimed: i128 = 0;
        // Tracked separately because a claim is only possible when the
        // investor's pro-rata share rounds to at least 1 — `claim_return`
        // panics with "nothing to return" otherwise, leaving the slot alone.
        let mut claimed: std::vec::Vec<&Address> = std::vec::Vec::new();
        let mut skipped: std::vec::Vec<(&Address, i128)> = std::vec::Vec::new();

        for inv in &investors {
            let contributed = client.get_contribution(&1u64, inv);
            if contributed <= 0 {
                continue;
            }
            let share = contributed * returnable / (target as i128);
            if share > 0 {
                client.claim_return(&1u64, inv);
                total_claimed += share;
                claimed.push(inv);
            } else {
                skipped.push((inv, contributed));
            }
        }

        prop_assert!(
            total_claimed <= returnable,
            "total_claimed={} > returnable={}", total_claimed, returnable
        );

        for inv in claimed {
            prop_assert_eq!(
                client.get_contribution(&1u64, inv),
                0i128,
                "contribution slot not zeroed after claim_return"
            );
        }

        for (inv, contributed) in skipped {
            prop_assert_eq!(
                client.get_contribution(&1u64, inv),
                contributed,
                "unclaimable contribution slot must be left untouched"
            );
        }
    }
}

// ── Scenario 3: Partial settlement — payout + refundable == held (exact) ─────
//
// Invariants verified:
//   • campaign.released     == payout_amount after PartialSettlement
//   • campaign.refundable   == held − payout_amount (no rounding loss)
//   • released + refundable == held  (exact conservation, no dust)
//   • escrow_held           == 0     (all funds accounted for)

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    #[test]
    fn prop_partial_settlement_conservation(
        target          in 3i64..=100_000i64,
        payout_frac_num in 1i64..=98i64,     // payout = frac/100 * held
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProductionEscrowContract);
        let client = super::ProductionEscrowContractClient::new(&env, &contract_id);

        let admin    = Address::generate(&env);
        let farmer   = Address::generate(&env);
        let investor = Address::generate(&env);

        let (token_addr, sac) = create_token(&env, &admin);
        sac.mint(&contract_id, &(target as i128));

        client.initialize(&admin);
        client.create_campaign(
            &1u64,
            &farmer,
            &(target as i128),
            &token_addr,
            &1_000_000u64,
            &Symbol::new(&env, "harvest"),
        );

        // Single investor funds the whole campaign.
        client.receive_contribution(&1u64, &investor, &(target as i128));
        client.complete_funding(&1u64, &(target as i128));

        // Investor opens a dispute while the campaign is Funded.
        client.open_dispute(&1u64, &investor, &Symbol::new(&env, "quality"));

        let held: i128          = target as i128; // released=refundable=returnable=0
        let payout_amount: i128 = (held * payout_frac_num as i128 / 100).max(1).min(held - 1);
        let expected_refundable = held - payout_amount;

        client.resolve_dispute(&1u64, &DisputeResolution::PartialSettlement, &payout_amount);

        let campaign = client.get_campaign(&1u64).unwrap();

        // Exact conservation: payout booked as released, remainder as refundable.
        prop_assert_eq!(
            campaign.released, payout_amount,
            "released ({}) != payout_amount ({})", campaign.released, payout_amount
        );
        prop_assert_eq!(
            campaign.refundable, expected_refundable,
            "refundable ({}) != expected ({})", campaign.refundable, expected_refundable
        );
        prop_assert_eq!(
            campaign.released + campaign.refundable,
            held,
            "released + refundable ({}) != held ({})",
            campaign.released + campaign.refundable,
            held
        );

        // escrow_held = total_funded − released − refundable − returnable must be 0.
        let escrow_held =
            campaign.total_funded - campaign.released - campaign.refundable - campaign.returnable;
        prop_assert_eq!(
            escrow_held,
            0i128,
            "escrow_held not zero after full dispute resolution: {}", escrow_held
        );
    }
}
