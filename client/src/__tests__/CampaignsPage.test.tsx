import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Campaign } from '../lib/soroban/types';

vi.mock('../lib/soroban/config', () => ({
  isEscrowConfigured: () => true,
}));

vi.mock('../hooks/useAllCampaigns', () => ({
  useAllCampaigns: vi.fn(),
}));

import { useAllCampaigns } from '../hooks/useAllCampaigns';
import { CampaignsPage } from '../pages/CampaignsPage';

const mockUseAllCampaigns = vi.mocked(useAllCampaigns);

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    farmer: 'GFARMER1234567890FARMER1234567890FARMER1234567890FARMER12',
    target_amount: 1000n,
    token_address: 'CTOKEN',
    deadline: 0n,
    harvest_metadata: 'Organic maize',
    total_funded: 250n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Funding' },
    ...overrides,
  };
}

function mockQuery(partial: Record<string, unknown>) {
  mockUseAllCampaigns.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...partial,
  } as unknown as ReturnType<typeof useAllCampaigns>);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CampaignsPage />
    </MemoryRouter>,
  );
}

describe('CampaignsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a live list of campaigns, each linking to its detail page', () => {
    mockQuery({
      data: [
        { id: '2', campaign: makeCampaign({ harvest_metadata: 'Coffee lot' }) },
        { id: '1', campaign: makeCampaign() },
      ],
    });
    renderPage();

    expect(screen.getByText('Coffee lot')).toBeInTheDocument();
    expect(screen.getByText('Organic maize')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Coffee lot/i });
    expect(link).toHaveAttribute('href', '/campaigns/2');
  });

  it('handles the empty state when no campaigns exist yet', () => {
    mockQuery({ data: [] });
    renderPage();
    expect(screen.getByText(/no campaigns yet/i)).toBeInTheDocument();
  });

  it('handles the error state on RPC/backend failure', () => {
    mockQuery({ isError: true });
    renderPage();
    expect(screen.getByText(/couldn.t load campaigns/i)).toBeInTheDocument();
  });

  it('shows a loading skeleton while fetching', () => {
    mockQuery({ isLoading: true });
    renderPage();
    expect(
      screen.getByLabelText(/loading campaign cards/i),
    ).toBeInTheDocument();
  });
});
