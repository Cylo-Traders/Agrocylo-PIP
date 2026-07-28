import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '../../context/WalletContext';
import {
  getRegistryClient,
  invokeContractWrite,
} from '../../lib/soroban/contractClient';
import { contractQueryKeys } from './queryKeys';
import { useMutationToasts } from './mutationToasts';

export interface RegisterCampaignInput {
  campaignId: bigint;
  farmer: string;
  title: string;
  description: string;
}

/** Registers campaign metadata (title/description) with the RegistryContract. */
export function useRegisterCampaign() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const { notifySuccess, notifyError } = useMutationToasts({
    success: 'Campaign registered',
    error: 'Could not register campaign',
  });

  return useMutation({
    mutationFn: async (input: RegisterCampaignInput) => {
      return invokeContractWrite(
        getRegistryClient(),
        'register_campaign',
        {
          campaign_id: input.campaignId,
          farmer: input.farmer,
          title: input.title,
          description: input.description,
        },
        wallet,
      );
    },
    onSuccess: (_data, input) => {
      notifySuccess(`Campaign #${input.campaignId.toString()} registered.`);
      queryClient.invalidateQueries({
        queryKey: contractQueryKeys.activity(input.campaignId.toString()),
      });
    },
    onError: notifyError,
  });
}
