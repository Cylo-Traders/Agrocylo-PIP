#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, String,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CampaignStatus {
    Funding,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HarvestMetadata {
    pub crop_type: String,
    pub expected_quantity: i128,
    pub expected_harvest_date: u64,
    pub region: String,
    pub metadata_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub campaign_id: BytesN<32>,
    pub farmer: Address,
    pub funding_target: i128,
    pub token_address: Address,
    pub deadline: u64,
    pub harvest: HarvestMetadata,
    pub status: CampaignStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignCreatedEvent {
    pub campaign_id: BytesN<32>,
    pub farmer: Address,
    pub funding_target: i128,
    pub token_address: Address,
    pub status: CampaignStatus,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Campaign(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ProductionEscrowError {
    InvalidFundingTarget = 1,
    DuplicateCampaignId = 2,
    CampaignNotFound = 3,
}

#[contract]
pub struct ProductionEscrowContract;

#[contractimpl]
impl ProductionEscrowContract {
    pub fn create_campaign(
        env: Env,
        campaign_id: BytesN<32>,
        farmer: Address,
        funding_target: i128,
        token_address: Address,
        deadline: u64,
        harvest: HarvestMetadata,
    ) -> Result<Campaign, ProductionEscrowError> {
        farmer.require_auth();

        if funding_target <= 0 {
            return Err(ProductionEscrowError::InvalidFundingTarget);
        }

        let key = DataKey::Campaign(campaign_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(ProductionEscrowError::DuplicateCampaignId);
        }

        let campaign = Campaign {
            campaign_id,
            farmer,
            funding_target,
            token_address,
            deadline,
            harvest,
            status: CampaignStatus::Funding,
        };

        env.storage().persistent().set(&key, &campaign);

        Self::publish_campaign_created(&env, &campaign);

        Ok(campaign)
    }

    pub fn get_campaign(
        env: Env,
        campaign_id: BytesN<32>,
    ) -> Result<Campaign, ProductionEscrowError> {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .ok_or(ProductionEscrowError::CampaignNotFound)
    }

    #[allow(deprecated)]
    fn publish_campaign_created(env: &Env, campaign: &Campaign) {
        env.events().publish(
            (
                String::from_str(env, "campaign-created"),
                campaign.campaign_id.clone(),
                campaign.farmer.clone(),
            ),
            CampaignCreatedEvent {
                campaign_id: campaign.campaign_id.clone(),
                farmer: campaign.farmer.clone(),
                funding_target: campaign.funding_target,
                token_address: campaign.token_address.clone(),
                status: campaign.status.clone(),
            },
        );
    }
}

#[cfg(test)]
mod test;
