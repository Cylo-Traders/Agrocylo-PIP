/** Central query key factory so read hooks and mutation invalidations stay in sync. */
export const contractQueryKeys = {
  campaign: (campaignId: string) => ['campaign', campaignId] as const,
  dispute: (campaignId: string) => ['dispute', campaignId] as const,
  contribution: (campaignId: string, address: string) =>
    ['contribution', campaignId, address] as const,
  tranches: (campaignId: string) => ['tranches', campaignId] as const,
  harvestRecord: (campaignId: string) => ['harvestRecord', campaignId] as const,
  farmer: (address: string) => ['farmer', address] as const,
  activity: (campaignId: string) => ['activity', campaignId] as const,
  escrowAdmin: () => ['escrowAdmin'] as const,
  adminCampaignsOverview: () => ['adminCampaignsOverview'] as const,
};
