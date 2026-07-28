use soroban_sdk::{contracttype, Address, String, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ActivityAction {
    CampaignCreated,
    CampaignFunded,
    CampaignStatusChanged,
    FundsReleased,
    HarvestReported,
    DisputeInitiated,
    DisputeResolved,
    CampaignSettled,
    FarmerRegistered,
    CampaignRegistered,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActivityRecord {
    pub actor: Address,
    pub action_type: ActivityAction,
    pub timestamp: u64,
    pub ledger_sequence: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FarmerProfile {
    pub address: Address,
    pub name: String,
    pub location: String,
    pub registration_time: u64,
}

/// Descriptive campaign metadata registered by the farmer (title/description).
/// See `CampaignRecord` for the escrow-linked record with lifecycle status.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignInfo {
    pub id: u64,
    pub farmer: Address,
    pub title: String,
    pub description: String,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CampaignStatus {
    Active,
    Funding,
    Funded,
    InProduction,
    Disputed,
    Resolved,
    Settled,
}

/// Links a campaign to its ProductionEscrowContract instance and crop/region
/// metadata, and tracks lifecycle status as it's mirrored over from the
/// escrow contract via `update_campaign_status`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignRecord {
    pub campaign_id: u64,
    pub farmer: Address,
    pub escrow_contract: Address,
    pub crop_metadata: Symbol,
    pub region_metadata: Symbol,
    pub status: CampaignStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    ApprovedContract(Address),
    CampaignActivities(u64),
    Farmer(Address),
    Campaign(u64),
    FarmerCount,
    CampaignCount,
    CampaignRecord(u64),
    FarmerCampaigns(Address),
}
