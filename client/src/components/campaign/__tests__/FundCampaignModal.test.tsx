import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FundCampaignModal } from '../FundCampaignModal';
import * as WalletContext from '../../../context/WalletContext';
import * as useEscrowMutations from '../../../hooks/contract/useEscrowMutations';

vi.mock('../../../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../../../hooks/contract/useEscrowMutations', () => ({
  useFundCampaign: vi.fn(),
}));

describe('FundCampaignModal', () => {
  let queryClient: QueryClient;
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(useEscrowMutations, 'useFundCampaign').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useEscrowMutations.useFundCampaign>);
  });

  const renderModal = (isOpen = true) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FundCampaignModal
          isOpen={isOpen}
          onClose={vi.fn()}
          campaignId="camp-101"
          campaignTitle="Maize Irrigation Campaign"
          totalTarget={50000}
          currentRaised={30000}
        />
      </QueryClientProvider>,
    );
  };

  it('displays wallet connection prompt when wallet is disconnected', () => {
    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: false,
      publicKey: null,
    } as unknown as ReturnType<typeof WalletContext.useWallet>);

    renderModal(true);

    expect(
      screen.getByText(/connect your wallet to fund this campaign/i),
    ).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', {
      name: /confirm contribution/i,
    });
    expect(submitBtn).toBeDisabled();
  });

  it('submits contribution via useFundCampaign mutation when wallet is connected', async () => {
    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: true,
      publicKey: 'GDF4...M9XZ',
    } as unknown as ReturnType<typeof WalletContext.useWallet>);

    mockMutateAsync.mockResolvedValueOnce({ txHash: '0x123abc' });

    renderModal(true);

    const input = screen.getByLabelText(/contribution amount/i);
    fireEvent.change(input, { target: { value: '500' } });

    const submitBtn = screen.getByRole('button', {
      name: /confirm contribution/i,
    });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        campaignId: 'camp-101',
        investor: 'GDF4...M9XZ',
        amount: 500n,
      });
    });

    expect(screen.getByText(/contribution successful!/i)).toBeInTheDocument();
  });
});
