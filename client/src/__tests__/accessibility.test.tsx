import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { axe, toHaveNoViolations } from 'jest-axe';
import type { ReactNode } from 'react';
import { queryClient } from '../lib/queryClient';
import { ToastProvider } from '../context/ToastContext';
import { WalletProvider } from '../context/WalletContext';
import DesignFoundationsPage from '../pages/DesignFoundationsPage';
import { AnalyticsDashboardPage } from '../pages/AnalyticsDashboardPage';
import { CreateCampaignPage } from '../pages/CreateCampaignPage';
import { FundCampaignModal } from '../components/campaign/FundCampaignModal';

expect.extend(toHaveNoViolations);

/**
 * happy-dom has no real layout/paint engine, so axe's `color-contrast` rule
 * cannot reliably compute rendered colors here. Contrast is verified
 * separately against the actual WCAG formula — see
 * docs/accessibility-audit.md — so it's disabled in this DOM-structural scan
 * to avoid false negatives/positives.
 */
const axeOptions = { rules: { 'color-contrast': { enabled: false } } };

function renderWithProviders(ui: ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ToastProvider>
          <WalletProvider>{ui}</WalletProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('accessibility: automated scan (axe-core) on audited routes', () => {
  it('DesignFoundationsPage ("/") reports no critical/serious violations', async () => {
    const { container } = renderWithProviders(<DesignFoundationsPage />);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it('AnalyticsDashboardPage ("/analytics") reports no critical/serious violations', async () => {
    const { container } = renderWithProviders(<AnalyticsDashboardPage />);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it('CreateCampaignPage reports no critical/serious violations', async () => {
    const { container } = renderWithProviders(<CreateCampaignPage />);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it('FundCampaignModal (campaign funding flow) reports no critical/serious violations', async () => {
    const { container } = renderWithProviders(
      <FundCampaignModal
        isOpen
        onClose={() => {}}
        campaignId="camp-1"
        campaignTitle="Test Campaign"
        totalTarget={1000}
        currentRaised={250}
      />,
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });
});

describe('accessibility: keyboard navigation through the campaign funding flow', () => {
  it('exposes the funding dialog with an accessible name and moves focus into it', async () => {
    renderWithProviders(
      <FundCampaignModal
        isOpen
        onClose={() => {}}
        campaignId="camp-1"
        campaignTitle="Test Campaign"
        totalTarget={1000}
        currentRaised={250}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /fund campaign/i });
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
  });

  it('traps Tab focus inside the dialog instead of escaping to the page', async () => {
    renderWithProviders(
      <FundCampaignModal
        isOpen
        onClose={() => {}}
        campaignId="camp-1"
        campaignTitle="Test Campaign"
        totalTarget={1000}
        currentRaised={250}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /fund campaign/i });
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
    );
    expect(focusable.length).toBeGreaterThan(1);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Tabbing forward from the last element wraps back to the first.
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    // Shift+Tab from the first element wraps back to the last.
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes on Escape without requiring a mouse', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <FundCampaignModal
        isOpen
        onClose={handleClose}
        campaignId="camp-1"
        campaignTitle="Test Campaign"
        totalTarget={1000}
        currentRaised={250}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('announces a validation error via role="alert" without touching the mouse', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <FundCampaignModal
        isOpen
        onClose={handleClose}
        campaignId="camp-1"
        campaignTitle="Test Campaign"
        totalTarget={1000}
        currentRaised={250}
      />,
    );

    const input = screen.getByLabelText(/contribution amount/i);
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.submit(input.closest('form')!);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('id', 'contribution-amount-error');
    expect(input).toHaveAttribute(
      'aria-describedby',
      'contribution-amount-error',
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
