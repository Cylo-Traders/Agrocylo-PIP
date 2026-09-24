import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import App from '../App';
import { ToastProvider } from '../context/ToastContext';
import { WalletProvider } from '../context/WalletContext';

/**
 * Regression coverage for the routing gaps reported in:
 *   - #143 "Most built pages are never wired into the router, and there is no
 *          catch-all 404 route"
 *   - #144 "Two different components are both named/exported as
 *          `InvestorDashboardPage`"
 *
 * The assertions below mirror those issues' acceptance criteria so the
 * behaviour cannot silently regress.
 */

function renderAt(path: string, ui: ReactNode = <App />) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <WalletProvider>{ui}</WalletProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App routing (#143)', () => {
  it('renders NotFoundPage for an unknown path instead of a blank screen', () => {
    renderAt('/this-route-does-not-exist');

    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The page you requested does not exist or may have moved.',
      ),
    ).toBeInTheDocument();
  });

  it('renders NotFoundPage for a nested unknown path', () => {
    renderAt('/campaigns/123/does-not-exist');

    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('routes /campaigns/new to the real CreateCampaignPage', () => {
    renderAt('/campaigns/new');

    // CreateCampaignPage is wired to real contract hooks, so it was the most
    // significant unreachable feature. Which heading renders depends on
    // whether Soroban RPC config is present in the test environment.
    const headings = screen
      .getAllByRole('heading', { level: 1 })
      .map((h) => h.textContent ?? '');

    expect(headings.join(' | ')).toMatch(
      /Create a campaign|Soroban RPC not configured/,
    );
  });

  it('routes /dashboard/farmer to FarmerDashboardPage', () => {
    renderAt('/dashboard/farmer');

    expect(screen.getByText('Farmer dashboard')).toBeInTheDocument();
  });

  it('routes /dashboard/admin to AdminDashboardPage', () => {
    renderAt('/dashboard/admin');

    const headings = screen
      .getAllByRole('heading', { level: 1 })
      .map((h) => h.textContent ?? '');

    expect(headings.join(' | ')).toMatch(
      /Admin dashboard|Soroban RPC not configured/,
    );
  });

  it('resolves every primary navigation target to a real route', () => {
    // These are exactly the links rendered by AppLayout's primary nav.
    const navTargets = [
      '/',
      '/campaigns',
      '/dashboard/farmer',
      '/dashboard/investor',
      '/dashboard/admin',
      '/activity',
      '/profile',
    ];

    for (const path of navTargets) {
      const { unmount } = renderAt(path);

      // The catch-all must not swallow a primary nav target.
      expect(screen.queryByText('Page not found')).toBeNull();

      // Every target except "/" resolves inside the AppLayout branch. Before
      // this fix /dashboard/* matched no route at all, so neither the layout
      // nor the page rendered — the nav links were dead ends.
      if (path !== '/') {
        expect(
          screen.getByRole('navigation', { name: 'Primary navigation' }),
        ).toBeInTheDocument();
      }

      unmount();
    }
  });
});

describe('InvestorDashboardPage duplicate export (#144)', () => {
  it('routes /dashboard/investor to the real implementation, not the placeholder', () => {
    renderAt('/dashboard/investor');

    // The real component renders "Investor Dashboard" and its wallet gate.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Investor Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();

    // The removed placeholder rendered this copy — it must not come back.
    expect(
      screen.queryByText(
        'Monitor your agricultural investments, campaign progress, and returns.',
      ),
    ).toBeNull();
  });

  it('re-exports the real implementation from pages/index.tsx', async () => {
    const pagesIndex = await import('../pages');
    const realModule = await import('../pages/InvestorDashboardPage');

    expect(pagesIndex.InvestorDashboardPage).toBe(
      realModule.InvestorDashboardPage,
    );
    expect(pagesIndex.InvestorDashboardPage).toBe(realModule.default);
  });
});
