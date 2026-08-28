import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvestorDashboardPage } from '../InvestorDashboardPage';
import * as WalletContext from '../../context/WalletContext';
import * as useInvestorPortfolioModule from '../../hooks/useInvestorPortfolio';
import * as useEscrowMutations from '../../hooks/contract/useEscrowMutations';

vi.mock('../../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../../hooks/useInvestorPortfolio', () => ({
  useInvestorPortfolio: vi.fn(),
}));

vi.mock('../../hooks/contract/useEscrowMutations', () => ({
  useClaimRefund: vi.fn(),
  useClaimReturn: vi.fn(),
}));

describe('InvestorDashboardPage', () => {
  let queryClient: QueryClient;
  const mockClaimRefund = vi.fn();
  const mockClaimReturn = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(useEscrowMutations, 'useClaimRefund').mockReturnValue({
      mutateAsync: mockClaimRefund,
    } as unknown as ReturnType<typeof useEscrowMutations.useClaimRefund>);

    vi.spyOn(useEscrowMutations, 'useClaimReturn').mockReturnValue({
      mutateAsync: mockClaimReturn,
    } as unknown as ReturnType<typeof useEscrowMutations.useClaimReturn>);
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <InvestorDashboardPage />
      </QueryClientProvider>,
    );
  };

  it('renders Connect Your Wallet state when wallet is disconnected', () => {
    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: false,
      publicKey: null,
    } as unknown as ReturnType<typeof WalletContext.useWallet>);

    vi.spyOn(
      useInvestorPortfolioModule,
      'useInvestorPortfolio',
    ).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useInvestorPortfolioModule.useInvestorPortfolio>);

    renderPage();

    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
    expect(screen.getByText(/wallet disconnected/i)).toBeInTheDocument();
  });

  it('renders investment portfolio cards when connected', async () => {
    vi.spyOn(WalletContext, 'useWallet').mockReturnValue({
      isConnected: true,
      publicKey: 'GUSER123',
    } as unknown as ReturnType<typeof WalletContext.useWallet>);

    vi.spyOn(
      useInvestorPortfolioModule,
      'useInvestorPortfolio',
    ).mockReturnValue({
      data: [
        {
          campaignId: 'camp-101',
          title: 'Maize Production PIP',
          amountContributed: 2500,
          status: 'Settled',
          claimableAmount: 3000,
          claimed: false,
          walletAddress: 'GUSER123',
          fundedAt: '2026-08-01T00:00:00Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useInvestorPortfolioModule.useInvestorPortfolio>);

    renderPage();

    expect(screen.getByText('Maize Production PIP')).toBeInTheDocument();
    expect(screen.getByText('Connected: GUSER123')).toBeInTheDocument();

    const claimBtn = screen.getByRole('button', { name: /claim return/i });
    fireEvent.click(claimBtn);

    await waitFor(() => {
      expect(mockClaimReturn).toHaveBeenCalledWith({
        campaignId: 'camp-101',
        investor: 'GUSER123',
      });
    });
  });
});
