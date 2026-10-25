import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { OpenDisputeForm } from '../components/campaign/OpenDisputeForm';
import {
  CampaignAdminPanel,
  type AdminCampaignOverview,
} from '../components/admin/CampaignAdminPanel';

expect.extend(toHaveNoViolations);

const mockOpenDispute = vi.fn();
const mockResolveDispute = vi.fn();

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue({ isConnected: true }),
  getAddress: vi.fn().mockResolvedValue({
    address: 'GFARMER0000000000000000000000000000000000000000000000000',
  }),
  getNetworkDetails: vi.fn().mockResolvedValue({
    networkPassphrase: 'Test SDF Network ; September 2015',
  }),
  signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: 'signed-xdr' }),
}));

vi.mock('../hooks/contract', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/contract')>();
  return {
    ...actual,
    useOpenDispute: () => ({ mutateAsync: mockOpenDispute, isPending: false }),
    useContribution: () => ({ data: 0n, isLoading: false }),
    useEscrowAdmin: () => ({
      data: 'GADMIN0000000000000000000000000000000000000000000000000',
      isLoading: false,
    }),
    useConfigureTranches: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useReleaseTranche: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useResolveDispute: () => ({
      mutateAsync: mockResolveDispute,
      isPending: false,
    }),
    useSettleCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useMarkFailed: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

const FARMER_ADDRESS =
  'GFARMER0000000000000000000000000000000000000000000000000';

const DISPUTED_OVERVIEW: AdminCampaignOverview = {
  id: '42',
  campaign: {
    farmer: FARMER_ADDRESS,
    target_amount: 1000n,
    token_address: 'CTOKEN0000000000000000000000000000000000000000000000000',
    deadline: 0n,
    harvest_metadata: 'maize',
    total_funded: 1000n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Disputed' },
  },
};

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
  beforeEach(() => {
    localStorage.setItem('agrocylo:wallet:address', FARMER_ADDRESS);
  });

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

  it('OpenDisputeForm (dispute opening flow) reports no critical/serious violations', async () => {
    const { container } = renderWithProviders(
      <OpenDisputeForm campaignId="42" farmerAddress={FARMER_ADDRESS} />,
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it('CampaignAdminPanel in Disputed status (dispute resolution flow) reports no critical/serious violations', async () => {
    const { container } = renderWithProviders(
      <CampaignAdminPanel overview={DISPUTED_OVERVIEW} />,
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

describe('accessibility: keyboard navigation and screen-reader announcements in dispute flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('agrocylo:wallet:address', FARMER_ADDRESS);
  });

  it('OpenDisputeForm: supports Tab navigation and announces validation errors via role="alert"', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <OpenDisputeForm campaignId="42" farmerAddress={FARMER_ADDRESS} />,
    );

    const textarea = screen.getByLabelText(/reason/i);
    const submitBtn = screen.getByRole('button', { name: /open dispute/i });

    // Focus moves to textarea
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // Tab moves to submit button
    await user.tab();
    expect(document.activeElement).toBe(submitBtn);

    // Submitting with empty reason triggers validation error
    await user.click(submitBtn);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('id', 'dispute-reason-error');
    expect(alert).toHaveTextContent(/enter a reason for the dispute/i);
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAttribute(
      'aria-describedby',
      'dispute-reason-error',
    );
  });

  it('OpenDisputeForm: announces success via role="status" after opening a dispute', async () => {
    mockOpenDispute.mockResolvedValueOnce('tx-dispute-123');
    const user = userEvent.setup();
    renderWithProviders(
      <OpenDisputeForm campaignId="42" farmerAddress={FARMER_ADDRESS} />,
    );

    const textarea = screen.getByLabelText(/reason/i);
    await user.type(textarea, 'Crop harvest failed due to severe flood.');
    await user.click(screen.getByRole('button', { name: /open dispute/i }));

    expect(mockOpenDispute).toHaveBeenCalledWith({
      campaignId: '42',
      opener: FARMER_ADDRESS,
      reason: 'Crop harvest failed due to severe flood.',
    });

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/dispute opened/i);
  });

  it('CampaignAdminPanel (Disputed): supports Tab navigation and announces validation errors via role="alert"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    const select = screen.getByRole('combobox', { name: /resolution/i });
    await user.selectOptions(select, 'PartialSettlement');

    const payoutInput = await screen.findByLabelText(/payout to farmer/i);
    const submitBtn = screen.getByRole('button', { name: /resolve dispute/i });

    // Tabbing between fields
    payoutInput.focus();
    expect(document.activeElement).toBe(payoutInput);
    await user.tab();
    expect(document.activeElement).toBe(submitBtn);

    // Enter out-of-range payout (1000 >= heldAmount of 1000)
    await user.type(payoutInput, '1000');
    await user.click(submitBtn);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('id', 'resolve-dispute-error');
    expect(alert).toHaveTextContent(
      /partial settlement payout must be greater than zero and less than the held amount/i,
    );
    expect(payoutInput).toHaveAttribute('aria-invalid', 'true');
    expect(payoutInput).toHaveAttribute(
      'aria-describedby',
      'resolve-dispute-error dispute-payout-hint',
    );
  });

  it('CampaignAdminPanel (Disputed): announces success via role="status" upon dispute resolution', async () => {
    mockResolveDispute.mockResolvedValueOnce('tx-resolve-123');
    const user = userEvent.setup();
    renderWithProviders(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    await user.click(screen.getByRole('button', { name: /resolve dispute/i }));

    expect(mockResolveDispute).toHaveBeenCalledWith({
      campaignId: '42',
      resolution: 'FullRefund',
      payoutAmount: 0n,
    });

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/dispute resolved/i);
  });
});
