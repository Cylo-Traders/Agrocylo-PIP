import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InvestorDashboardPage } from '../InvestorDashboardPage';
import type { FundedInvestment } from '../../lib/soroban/investorService';
import * as investorService from '../../lib/soroban/investorService';

const WALLET = 'GINVESTOR000000000000000000000000000000000000000000000B2';

const mockUseWallet = vi.fn();
vi.mock('../../context/WalletContext', () => ({
  useWallet: () => mockUseWallet(),
  truncateAddress: (addr: string) =>
    addr.length <= 12 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`,
}));

const mockUseClaimRefund = vi.fn();
const mockUseClaimReturn = vi.fn();
vi.mock('../../hooks/contract', () => ({
  useClaimRefund: () => mockUseClaimRefund(),
  useClaimReturn: () => mockUseClaimReturn(),
}));

const mockUseInvestorPortfolio = vi.fn();
vi.mock('../../hooks/useInvestorPortfolio', () => ({
  useInvestorPortfolio: (...args: unknown[]) =>
    mockUseInvestorPortfolio(...args),
}));

const mockIsEscrowConfigured = vi.fn();
vi.mock('../../lib/soroban/config', () => ({
  isEscrowConfigured: () => mockIsEscrowConfigured(),
}));

const SETTLED_INVESTMENT: FundedInvestment = {
  campaignId: '42',
  title: 'On-chain Maize PIP',
  amountContributed: 5000,
  status: 'Settled',
  claimableAmount: 1250,
  claimed: false,
  walletAddress: WALLET,
  fundedAt: '2026-06-01T14:30:00.000Z',
};

const FAILED_INVESTMENT: FundedInvestment = {
  campaignId: '7',
  title: 'Failed Fertilizer PIP',
  amountContributed: 1500,
  status: 'Failed',
  claimableAmount: 1500,
  claimed: false,
  walletAddress: WALLET,
  fundedAt: '2026-05-20T09:15:00.000Z',
};

function mockWallet(publicKey: string | null) {
  mockUseWallet.mockReturnValue({
    publicKey,
    isConnected: publicKey !== null,
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearError: vi.fn(),
    signTransaction: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <InvestorDashboardPage />
    </MemoryRouter>,
  );
}

describe('InvestorDashboardPage', () => {
  const mutateRefund = vi.fn();
  const mutateReturn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEscrowConfigured.mockReturnValue(true);
    mutateRefund.mockResolvedValue(undefined);
    mutateReturn.mockResolvedValue(undefined);
    mockUseClaimRefund.mockReturnValue({
      mutateAsync: mutateRefund,
      isPending: false,
    });
    mockUseClaimReturn.mockReturnValue({
      mutateAsync: mutateReturn,
      isPending: false,
    });
    mockUseInvestorPortfolio.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      isSuccess: false,
    });
  });

  it('asks the user to connect a wallet instead of showing a fake portfolio', () => {
    mockWallet(null);

    renderPage();

    expect(
      screen.getByRole('heading', {
        name: /connect to view your investments/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /connect wallet/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/organic maize/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/GDF4\.\.\.M9XZ/)).not.toBeInTheDocument();
    expect(mockUseInvestorPortfolio).toHaveBeenCalledWith(null);
  });

  it('renders on-chain portfolio rows for the connected wallet', () => {
    mockWallet(WALLET);
    mockUseInvestorPortfolio.mockReturnValue({
      data: [SETTLED_INVESTMENT, FAILED_INVESTMENT],
      isLoading: false,
      isError: false,
      isSuccess: true,
    });

    renderPage();

    expect(mockUseInvestorPortfolio).toHaveBeenCalledWith(WALLET);
    expect(screen.getByText('On-chain Maize PIP')).toBeInTheDocument();
    expect(screen.getByText('Failed Fertilizer PIP')).toBeInTheDocument();
    expect(screen.getByText(/Connected: GINVES\.\.\.00B2/)).toBeInTheDocument();
    expect(screen.queryByText(/organic maize/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /claim return/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /claim refund/i }),
    ).toBeInTheDocument();
  });

  it('sends claim refund and claim return through the contract mutation hooks', async () => {
    const user = userEvent.setup();
    mockWallet(WALLET);
    mockUseInvestorPortfolio.mockReturnValue({
      data: [SETTLED_INVESTMENT, FAILED_INVESTMENT],
      isLoading: false,
      isError: false,
      isSuccess: true,
    });

    const randomSpy = vi.spyOn(Math, 'random');
    const claimRefundSpy = vi.spyOn(investorService, 'claimRefund');
    const claimReturnSpy = vi.spyOn(investorService, 'claimReturn');

    renderPage();

    await user.click(screen.getByRole('button', { name: /claim refund/i }));
    await user.click(screen.getByRole('button', { name: /claim return/i }));

    expect(mutateRefund).toHaveBeenCalledWith({
      campaignId: '7',
      investor: WALLET,
    });
    expect(mutateReturn).toHaveBeenCalledWith({
      campaignId: '42',
      investor: WALLET,
    });
    expect(claimRefundSpy).not.toHaveBeenCalled();
    expect(claimReturnSpy).not.toHaveBeenCalled();
    expect(randomSpy).not.toHaveBeenCalled();

    randomSpy.mockRestore();
  });

  it('shows an empty on-chain state when the connected wallet has no investments', () => {
    mockWallet(WALLET);
    mockUseInvestorPortfolio.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      isSuccess: true,
    });

    renderPage();

    expect(
      screen.getByRole('heading', { name: /no funded investments found/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/organic maize/i)).not.toBeInTheDocument();
  });
});
