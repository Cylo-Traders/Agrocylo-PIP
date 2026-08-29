import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ActivityRecord } from '../lib/soroban/types';
import {
  formatActivityLine,
  getActivityMeta,
} from '../lib/activity/activityLabels';
import type { ActivityActionTag } from '../lib/soroban/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../lib/soroban/config', () => ({
  isRegistryConfigured: () => true,
}));

vi.mock('../lib/contracts/registry', () => ({
  getCampaignActivities: vi.fn(),
}));

import { getCampaignActivities } from '../lib/contracts/registry';
const mockGetCampaignActivities = vi.mocked(getCampaignActivities);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(
  tag: ActivityActionTag,
  actor = 'GACTOR1234567890ACTOR1234567890ACTOR1234567890ACTOR123456',
  timestampOffset = 0,
): ActivityRecord {
  return {
    actor,
    action_type: { tag },
    timestamp: BigInt(1_700_000_000 + timestampOffset),
    ledger_sequence: 1000 + timestampOffset,
  };
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// activityLabels unit tests
// ---------------------------------------------------------------------------

describe('getActivityMeta', () => {
  it('returns correct label for every ActivityActionTag', () => {
    const tags: ActivityActionTag[] = [
      'CampaignCreated',
      'CampaignFunded',
      'CampaignStatusChanged',
      'FundsReleased',
      'HarvestReported',
      'DisputeInitiated',
      'DisputeResolved',
      'CampaignSettled',
      'FarmerRegistered',
      'CampaignRegistered',
    ];

    for (const tag of tags) {
      const meta = getActivityMeta(tag);
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.colorClass).toBeTruthy();
    }
  });

  it('returns fallback for unknown tag', () => {
    const meta = getActivityMeta('UnknownAction' as any);
    expect(meta.label).toBe('UnknownAction');
    expect(meta.icon).toBe('•');
  });
});

describe('formatActivityLine', () => {
  const actor = 'GACTOR1234567890ACTOR1234567890ACTOR1234567890ACTOR123456';

  it('includes actor short form in output', () => {
    const line = formatActivityLine('CampaignCreated', actor);
    expect(line).toMatch(/GACTOR/);
  });

  it('includes campaign ID when provided', () => {
    const line = formatActivityLine('CampaignFunded', actor, 42n);
    expect(line).toMatch(/Campaign #42/);
  });

  it('produces non-empty string for every action tag', () => {
    const tags: ActivityActionTag[] = [
      'CampaignCreated',
      'CampaignFunded',
      'CampaignStatusChanged',
      'FundsReleased',
      'HarvestReported',
      'DisputeInitiated',
      'DisputeResolved',
      'CampaignSettled',
      'FarmerRegistered',
      'CampaignRegistered',
    ];
    for (const tag of tags) {
      const line = formatActivityLine(tag, actor);
      expect(line.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// ActivityFeedItem component tests
// ---------------------------------------------------------------------------

describe('ActivityFeedItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the action tag badge and human-readable line', async () => {
    const { ActivityFeedItem } =
      await import('../components/campaign/ActivityFeed/ActivityFeedItem');
    const record = makeRecord('HarvestReported');

    render(
      <Wrapper>
        <ul>
          <ActivityFeedItem record={record} campaignId={1n} />
        </ul>
      </Wrapper>,
    );

    // The badge carries the action label; the sentence underneath comes from
    // formatActivityLine ("<actor> reported harvest on Campaign #1"). They are
    // separate elements, so assert them separately.
    expect(screen.getByText('Harvest reported')).toBeInTheDocument();
    expect(
      screen.getByText(/reported harvest on Campaign #1/i),
    ).toBeInTheDocument();
  });

  it('renders a <time> element with an ISO dateTime attribute', async () => {
    const { ActivityFeedItem } =
      await import('../components/campaign/ActivityFeed/ActivityFeedItem');
    const record = makeRecord('FarmerRegistered');

    render(
      <Wrapper>
        <ul>
          <ActivityFeedItem record={record} />
        </ul>
      </Wrapper>,
    );

    const time = document.querySelector('time');
    expect(time).not.toBeNull();
    expect(time?.getAttribute('dateTime')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ---------------------------------------------------------------------------
// ActivityFeed component tests
// ---------------------------------------------------------------------------

describe('ActivityFeed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders loading spinner while fetching', async () => {
    mockGetCampaignActivities.mockReturnValue(new Promise(() => {}));
    const { ActivityFeed } =
      await import('../components/campaign/ActivityFeed/ActivityFeed');

    render(
      <Wrapper>
        <ActivityFeed campaignId={1n} />
      </Wrapper>,
    );

    expect(
      screen.getByRole('status', { name: /loading/i }),
    ).toBeInTheDocument();
  });

  it('renders "No activity" when the contract returns an empty list', async () => {
    mockGetCampaignActivities.mockResolvedValue([]);
    const { ActivityFeed } =
      await import('../components/campaign/ActivityFeed/ActivityFeed');

    render(
      <Wrapper>
        <ActivityFeed campaignId={1n} />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText(/no activity recorded yet/i)).toBeInTheDocument(),
    );
  });

  it('renders activity records sorted newest first', async () => {
    const records: ActivityRecord[] = [
      makeRecord('CampaignCreated', undefined, 0),
      makeRecord('HarvestReported', undefined, 100),
      makeRecord('CampaignFunded', undefined, 50),
    ];
    mockGetCampaignActivities.mockResolvedValue(records);
    const { ActivityFeed } =
      await import('../components/campaign/ActivityFeed/ActivityFeed');

    render(
      <Wrapper>
        <ActivityFeed campaignId={1n} pageSize={10} />
      </Wrapper>,
    );

    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(3));

    const items = screen.getAllByRole('listitem');
    // HarvestReported (offset=100) should be first (newest)
    expect(items[0]).toHaveTextContent(/Harvest reported/i);
  });

  it('paginates and shows prev/next buttons when records exceed pageSize', async () => {
    const records: ActivityRecord[] = Array.from({ length: 15 }, (_, i) =>
      makeRecord('CampaignFunded', undefined, i),
    );
    mockGetCampaignActivities.mockResolvedValue(records);
    const { ActivityFeed } =
      await import('../components/campaign/ActivityFeed/ActivityFeed');

    render(
      <Wrapper>
        <ActivityFeed campaignId={1n} pageSize={5} />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('navigation', { name: /pagination/i }),
      ).toBeInTheDocument(),
    );

    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  it('navigates to next page on click', async () => {
    const user = userEvent.setup();
    const records: ActivityRecord[] = Array.from({ length: 12 }, (_, i) =>
      makeRecord('CampaignFunded', undefined, i),
    );
    mockGetCampaignActivities.mockResolvedValue(records);
    const { ActivityFeed } =
      await import('../components/campaign/ActivityFeed/ActivityFeed');

    render(
      <Wrapper>
        <ActivityFeed campaignId={1n} pageSize={5} />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    mockGetCampaignActivities.mockRejectedValue(new Error('Network error'));
    const { ActivityFeed } =
      await import('../components/campaign/ActivityFeed/ActivityFeed');

    render(
      <Wrapper>
        <ActivityFeed campaignId={1n} />
      </Wrapper>,
    );

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(
      /failed to load activity/i,
    );
  });

  it('renders Refresh button that triggers re-fetch', async () => {
    const user = userEvent.setup();
    mockGetCampaignActivities.mockResolvedValue([
      makeRecord('CampaignCreated'),
    ]);
    const { ActivityFeed } =
      await import('../components/campaign/ActivityFeed/ActivityFeed');

    render(
      <Wrapper>
        <ActivityFeed campaignId={1n} />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /refresh/i }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /refresh/i }));
    // No crash and button still present
    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeInTheDocument();
  });

  it('global feed aggregates records from multiple campaign IDs', async () => {
    mockGetCampaignActivities
      .mockResolvedValueOnce([makeRecord('CampaignCreated', undefined, 0)])
      .mockResolvedValueOnce([makeRecord('HarvestReported', undefined, 100)]);

    const { ActivityFeed } =
      await import('../components/campaign/ActivityFeed/ActivityFeed');

    render(
      <Wrapper>
        <ActivityFeed campaignIds={[1n, 2n]} pageSize={10} />
      </Wrapper>,
    );

    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(2));

    expect(mockGetCampaignActivities).toHaveBeenCalledTimes(2);
  });
});
