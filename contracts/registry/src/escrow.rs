//! Client for cross-contract calls into ProductionEscrowContract.
//!
//! Declared with `#[contractclient]` instead of depending on the
//! `production_escrow` crate. Depending on it would link that contract's
//! object code into `registry.wasm`, and because both contracts export
//! `initialize`, `get_admin` and `get_campaign`, the wasm module would fail to
//! link with duplicate symbol errors.
//!
//! The signatures below must stay in step with ProductionEscrowContract's
//! public functions — a mismatch is only detected when the call is made
//! on-chain. `integration_tests` exercises this path against the real escrow
//! contract, which is what keeps the two in sync.

use escrow_types::Campaign;
use soroban_sdk::{contractclient, Env};

// The trait exists solely to drive `#[contractclient]`; only the generated
// client is ever called, so the trait itself is legitimately never used.
#[allow(dead_code)]
#[contractclient(name = "ProductionEscrowContractClient")]
pub trait ProductionEscrowInterface {
    /// Mirrors `ProductionEscrowContract::get_campaign`.
    fn get_campaign(env: Env, campaign_id: u64) -> Option<Campaign>;
}
