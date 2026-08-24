import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CampaignDetailPage } from '../CampaignDetailPage';
import type { Campaign } from '../../lib/soroban/types';

const mockUseCampaign = vi.fn();
vi.mock('../../hooks/contract/useEscrowQueries', () => ({
  useCampaign: (id: string | undefined) => mockUseCampaign(id),
}));

vi.mock('../../hooks/useCampaignLiveUpdates', () => ({
  useCampaignLiveUpdates: () => undefined,
}));

vi.mock('../../components/campaign/ActivityFeed', () => ({
  ActivityFeed: ({ campaignId }: { campaignId: bigint }) => (
    <div data-testid="activity-feed">{campaignId.toString()}</div>
  ),
}));

vi.mock('../../components/campaign/FundCampaignModal', () => ({
  FundCampaignModal: () => null,
}));

function campaignFor(id: string, harvest: string): Campaign {
  return {
    farmer: 'GFARMER0000000000000000000000000000000000000000000000000',
    target_amount: 50000n,
    token_address: 'CTOKEN0000000000000000000000000000000000000000000000000',
    deadline: 0n,
    harvest_metadata: harvest,
    total_funded: 32500n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Funding' },
  };
}

function renderAt(id: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/campaigns/${id}`]}>
        <Routes>
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CampaignDetailPage route param', () => {
  beforeEach(() => {
    mockUseCampaign.mockImplementation((id: string | undefined) => ({
      data: id ? campaignFor(id, `crop-${id}`) : undefined,
      isLoading: false,
      isError: false,
      error: null,
    }));
  });

  it('renders the campaign matching the route :id, not a hardcoded mock', () => {
    renderAt('42');
    expect(mockUseCampaign).toHaveBeenCalledWith('42');
    expect(screen.getByText('crop-42')).toBeInTheDocument();
    expect(screen.getByText('ID: 42')).toBeInTheDocument();
    expect(screen.queryByText('camp-101')).not.toBeInTheDocument();
  });

  it('renders a different campaign when the route id changes', () => {
    renderAt('7');
    expect(mockUseCampaign).toHaveBeenCalledWith('7');
    expect(screen.getByText('crop-7')).toBeInTheDocument();
    expect(screen.getByText('ID: 7')).toBeInTheDocument();
  });
});
