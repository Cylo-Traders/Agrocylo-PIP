import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from '../AdminDashboardPage';

const ADMIN_ADDRESS =
  'GADMIN00000000000000000000000000000000000000000000000000A';
const NON_ADMIN_ADDRESS =
  'GUSER0000000000000000000000000000000000000000000000000000';

const mockUseWallet = vi.fn();
vi.mock('../../context/WalletContext', () => ({
  useWallet: () => mockUseWallet(),
  truncateAddress: (addr: string) => addr,
}));

const mockUseEscrowAdmin = vi.fn();
vi.mock('../../hooks/contract', () => ({
  useEscrowAdmin: () => mockUseEscrowAdmin(),
  useConfigureTranches: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReleaseTranche: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResolveDispute: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSettleCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkFailed: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const mockUseAdminCampaigns = vi.fn();
vi.mock('../../hooks/useAdminCampaigns', () => ({
  useAdminCampaigns: () => mockUseAdminCampaigns(),
}));

vi.mock('../../lib/soroban/config', () => ({
  isEscrowConfigured: () => true,
}));

const CAMPAIGN_OVERVIEW = {
  id: '1',
  campaign: {
    farmer: 'GFARMER0000000000000000000000000000000000000000000000000',
    target_amount: 1000n,
    token_address: 'CTOKEN0000000000000000000000000000000000000000000000000',
    deadline: 0n,
    harvest_metadata: 'maize',
    total_funded: 1000n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Funded' as const },
  },
};

function mockWallet(publicKey: string) {
  mockUseWallet.mockReturnValue({
    publicKey,
    isConnected: true,
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearError: vi.fn(),
    signTransaction: vi.fn(),
  });
}

describe('AdminDashboardPage admin gating', () => {
  beforeEach(() => {
    mockUseAdminCampaigns.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: [CAMPAIGN_OVERVIEW],
    });
    mockUseEscrowAdmin.mockReturnValue({
      data: ADMIN_ADDRESS,
      isLoading: false,
      isError: false,
      isSuccess: true,
    });
  });

  it('never renders an admin action form for a non-admin wallet, even though the same campaign data is loaded', () => {
    mockWallet(NON_ADMIN_ADDRESS);

    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /configure tranches/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /release tranche/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /mark campaign as failed/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the applicable admin action forms once the connected wallet matches the escrow admin address', () => {
    mockWallet(ADMIN_ADDRESS);

    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/not authorized/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /configure tranches/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /release tranche/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /mark campaign as failed/i }),
    ).toBeInTheDocument();
  });
});
