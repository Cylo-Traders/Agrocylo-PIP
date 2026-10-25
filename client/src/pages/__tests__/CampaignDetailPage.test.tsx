import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CampaignDetailPage } from '../CampaignDetailPage';
import * as useEscrowQueries from '../../hooks/contract/useEscrowQueries';

vi.mock('../../hooks/contract/useEscrowQueries', () => ({
  useCampaign: vi.fn(),
}));

vi.mock('../../hooks/useCampaignLiveUpdates', () => ({
  useCampaignLiveUpdates: vi.fn(),
}));

vi.mock('../../components/campaign/ActivityFeed', () => ({
  ActivityFeed: ({ campaignId }: { campaignId?: bigint }) => (
    <div data-testid="activity-feed" data-campaign-id={campaignId?.toString()}>
      Activity Feed Component
    </div>
  ),
}));

vi.mock('../../components/campaign/FundCampaignModal', () => ({
  FundCampaignModal: () => (
    <div data-testid="fund-modal">Fund Modal Component</div>
  ),
}));

vi.mock('../../components/campaign/OpenDisputeForm', () => ({
  OpenDisputeForm: () => (
    <div data-testid="open-dispute-form">Open Dispute Form Component</div>
  ),
}));

describe('CampaignDetailPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = (campaignId: string = '101') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/campaigns/${campaignId}`]}>
          <Routes>
            <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('renders skeleton loading state while fetching campaign', () => {
    vi.spyOn(useEscrowQueries, 'useCampaign').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEscrowQueries.useCampaign>);

    renderComponent('101');
    expect(
      screen.getByRole('status', { name: /loading detail page/i }),
    ).toBeInTheDocument();
  });

  it('renders Campaign Not Found state when query fails or data is missing', () => {
    vi.spyOn(useEscrowQueries, 'useCampaign').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEscrowQueries.useCampaign>);

    renderComponent('999');
    expect(screen.getByText(/Campaign Not Found/i)).toBeInTheDocument();
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it('renders real campaign details when campaign data is returned', async () => {
    vi.spyOn(useEscrowQueries, 'useCampaign').mockReturnValue({
      data: {
        farmer: 'GDF4...M9XZ',
        target_amount: 50000n,
        token_address: 'CB...123',
        deadline: 1700000000n,
        harvest_metadata: 'Organic Maize Harvest PIP',
        total_funded: 32500n,
        released: 0n,
        refundable: 0n,
        returnable: 0n,
        status: { tag: 'Funding' },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEscrowQueries.useCampaign>);

    renderComponent('42');

    await waitFor(() => {
      expect(screen.getByText('Organic Maize Harvest PIP')).toBeInTheDocument();
    });

    expect(screen.getByText('ID: 42')).toBeInTheDocument();
    expect(screen.getByText(/Farmer: GDF4...M9XZ/i)).toBeInTheDocument();
    expect(screen.getByText(/\$32,500/i)).toBeInTheDocument();
    expect(screen.getByText(/Target: \$50,000/i)).toBeInTheDocument();

    const activityFeed = screen.getByTestId('activity-feed');
    expect(activityFeed).toHaveAttribute('data-campaign-id', '42');
  });
});
