import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getFarmer,
  getCampaign,
  getCampaignActivities,
  registerFarmer,
  registerCampaign,
  recordActivity,
} from '../registry';
import * as contractClient from '../../soroban/contractClient';
import type { ContractWallet } from '../../soroban/contractClient';
import type {
  ActivityRecord,
  CampaignInfo,
  FarmerProfile,
} from '../../soroban/types';

vi.mock('../../soroban/contractClient', () => ({
  getRegistryClient: vi.fn(),
  contractMethod: vi.fn(),
  invokeContractWrite: vi.fn(),
}));

const FARMER: FarmerProfile = {
  address: 'GABCDEF123...',
  name: 'Alice',
  location: 'Farmland',
  registration_time: 1000n,
};

const CAMPAIGN: CampaignInfo = {
  id: 1n,
  farmer: 'GABCDEF123...',
  title: 'Test Campaign',
  description: 'A test campaign',
  created_at: 1000n,
};

const ACTIVITIES: ActivityRecord[] = [
  {
    actor: 'GABCDEF123...',
    action_type: { tag: 'CampaignCreated' },
    timestamp: 1000n,
    ledger_sequence: 100,
  },
];

const WALLET: ContractWallet = {
  publicKey: 'GABCDEF123...',
  signTransaction: vi.fn(),
};

describe('registry', () => {
  let mockCall: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCall = vi.fn();
    vi.mocked(contractClient.getRegistryClient).mockResolvedValue({} as never);
    vi.mocked(contractClient.contractMethod).mockReturnValue(mockCall as never);
  });

  describe('getFarmer', () => {
    it('returns a FarmerProfile on success', async () => {
      mockCall.mockResolvedValue({ result: FARMER });
      await expect(getFarmer('GABCDEF123...')).resolves.toEqual(FARMER);
    });

    it('throws when the contract errors', async () => {
      mockCall.mockRejectedValue(new Error('farmer not found'));
      await expect(getFarmer('GUNKNOWN...')).rejects.toThrow(
        'farmer not found',
      );
    });
  });

  describe('getCampaign', () => {
    it('returns a CampaignInfo on success', async () => {
      mockCall.mockResolvedValue({ result: CAMPAIGN });
      await expect(getCampaign(1n)).resolves.toEqual(CAMPAIGN);
    });

    it('throws when the contract errors', async () => {
      mockCall.mockRejectedValue(new Error('campaign not found'));
      await expect(getCampaign(99n)).rejects.toThrow('campaign not found');
    });
  });

  describe('getCampaignActivities', () => {
    it('returns an ActivityRecord array on success', async () => {
      mockCall.mockResolvedValue({ result: ACTIVITIES });
      await expect(getCampaignActivities(1n)).resolves.toEqual(ACTIVITIES);
    });

    it('throws when the contract errors', async () => {
      mockCall.mockRejectedValue(new Error('no activities'));
      await expect(getCampaignActivities(99n)).rejects.toThrow('no activities');
    });
  });

  describe('registerFarmer', () => {
    it('calls invokeContractWrite with the correct args', async () => {
      vi.mocked(contractClient.invokeContractWrite).mockResolvedValue(
        undefined,
      );
      await registerFarmer('GALICE...', 'Alice', 'Farmland', WALLET);
      expect(contractClient.invokeContractWrite).toHaveBeenCalledWith(
        expect.any(Promise),
        'register_farmer',
        { farmer: 'GALICE...', name: 'Alice', location: 'Farmland' },
        WALLET,
      );
    });

    it('throws when the contract errors', async () => {
      vi.mocked(contractClient.invokeContractWrite).mockRejectedValue(
        new Error('farmer already registered'),
      );
      await expect(
        registerFarmer('GALICE...', 'Alice', 'Farmland', WALLET),
      ).rejects.toThrow('farmer already registered');
    });
  });

  describe('registerCampaign', () => {
    it('calls invokeContractWrite with the correct args', async () => {
      vi.mocked(contractClient.invokeContractWrite).mockResolvedValue(
        undefined,
      );
      await registerCampaign(1n, 'GALICE...', 'Title', 'Desc', WALLET);
      expect(contractClient.invokeContractWrite).toHaveBeenCalledWith(
        expect.any(Promise),
        'register_campaign',
        {
          campaign_id: 1n,
          farmer: 'GALICE...',
          title: 'Title',
          description: 'Desc',
        },
        WALLET,
      );
    });

    it('throws when the contract errors', async () => {
      vi.mocked(contractClient.invokeContractWrite).mockRejectedValue(
        new Error('campaign already registered'),
      );
      await expect(
        registerCampaign(1n, 'GALICE...', 'Title', 'Desc', WALLET),
      ).rejects.toThrow('campaign already registered');
    });
  });

  describe('recordActivity', () => {
    it('calls invokeContractWrite with the correct args', async () => {
      vi.mocked(contractClient.invokeContractWrite).mockResolvedValue(
        undefined,
      );
      await recordActivity(1n, 'GALICE...', 'CampaignCreated', WALLET);
      expect(contractClient.invokeContractWrite).toHaveBeenCalledWith(
        expect.any(Promise),
        'record_activity',
        {
          campaign_id: 1n,
          actor: 'GALICE...',
          action_type: { tag: 'CampaignCreated' },
        },
        WALLET,
      );
    });

    it('throws when the contract errors', async () => {
      vi.mocked(contractClient.invokeContractWrite).mockRejectedValue(
        new Error('invalid action'),
      );
      await expect(
        recordActivity(1n, 'GALICE...', 'CampaignCreated', WALLET),
      ).rejects.toThrow('invalid action');
    });
  });
});
