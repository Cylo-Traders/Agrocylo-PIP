use soroban_sdk::{contracttype, Address, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CampaignStatus {
    Active,
    Funding,
    Funded,
    InProduction,
    Harvested,
    Disputed,
    Resolved,
    Settled,
    Failed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeStatus {
    Open,
    Resolved,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeResolution {
    Pending,
    FullRefund,
    PartialSettlement,
    FullPayout,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub farmer: Address,
    pub target_amount: i128,
    pub token_address: Address,
    pub deadline: u64,
    pub harvest_metadata: Symbol,
    pub total_funded: i128,
    pub released: i128,
    pub refundable: i128,
    pub returnable: i128,
    pub status: CampaignStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HarvestRecord {
    pub farmer: Address,
    pub outcome: Symbol,
    pub timestamp: u64,
    pub ledger_sequence: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Dispute {
    pub campaign_id: u64,
    pub opener: Address,
    pub reason: Symbol,
    pub timestamp: u64,
    pub ledger_sequence: u32,
    pub status: DisputeStatus,
    pub resolution: DisputeResolution,
}

/// A single milestone/tranche definition.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tranche {
    /// Maximum amount that can be released for this tranche.
    pub amount: i128,
    /// Human-readable milestone label (e.g. "planting", "harvest").
    pub milestone: Symbol,
    /// Whether this tranche has already been released.
    pub released: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Campaign(u64),
    Dispute(u64),
    Contribution(u64, Address),
    /// Ordered list of tranches for a campaign.
    Tranches(u64),
    HarvestRecord(u64),
}

pub type TrancheList = Vec<Tranche>;
