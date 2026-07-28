import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CampaignCardSkeleton,
  CampaignCardsSkeleton,
  ChartsGridSkeleton,
  DashboardRowSkeleton,
  DashboardRowsSkeleton,
  DetailPageSkeleton,
  Skeleton,
} from './Skeleton';

describe('Skeleton components', () => {
  it('renders the base skeleton block', () => {
    const { container } = render(<Skeleton className="ui-skeleton--title" />);
    expect(container.querySelector('.ui-skeleton')).toBeTruthy();
  });

  it('exposes accessible labels on composed skeletons', () => {
    render(
      <>
        <CampaignCardSkeleton />
        <DashboardRowSkeleton />
        <DetailPageSkeleton />
        <DashboardRowsSkeleton count={2} />
        <CampaignCardsSkeleton count={2} />
        <ChartsGridSkeleton count={2} />
      </>,
    );

    expect(
      screen.getAllByLabelText(/loading campaign card/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText(/loading dashboard row/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText(/loading detail page/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/loading rows/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/loading campaign cards/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/loading analytics charts/i),
    ).toBeInTheDocument();
  });
});
