import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { OpenDisputeForm } from '../components/campaign/OpenDisputeForm';
import { CampaignAdminPanel } from '../components/admin/CampaignAdminPanel';

expect.extend(toHaveNoViolations);

/**
 * happy-dom has no real layout/paint engine, so axe's `color-contrast` rule
 * cannot reliably compute rendered colors here. Contrast is verified
 * separately against the actual WCAG formula — see
 * docs/accessibility-audit.md — so it's disabled in this DOM-structural scan
 * to avoid false negatives/positives.
 */
const axeOptions = { rules: { 'color-contrast': { enabled: false } } };

const FARMER = 'GFARMER0000000000000000000000000000000000000000000000000';
const ADMIN = 'GADMIN00000000000000000000000000000000000000000000000000';

const { mockOpenDispute, mockResolveDispute, walletState } = vi.hoisted(() => ({
  mockOpenDispute: vi.fn(),
  mockResolveDispute: vi.fn(),
  walletState: { publicKey: null as string | null },
}));

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({ publicKey: walletState.publicKey }),
}));

vi.mock('../hooks/contract', () => ({
  useOpenDispute: () => ({
    mutateAsync: mockOpenDispute,
    isPending: false,
  }),
  useContribution: () => ({ data: 0n }),
  useEscrowAdmin: () => ({ data: ADMIN }),
  useConfigureTranches: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReleaseTranche: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResolveDispute: () => ({
    mutateAsync: mockResolveDispute,
    isPending: false,
  }),
  useSettleCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkFailed: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// held = total_funded - released - refundable - returnable = 1000.
const DISPUTED_OVERVIEW = {
  id: '42',
  campaign: {
    farmer: FARMER,
    target_amount: 1000n,
    token_address: 'CTOKEN0000000000000000000000000000000000000000000000000',
    deadline: 0n,
    harvest_metadata: 'maize',
    total_funded: 1000n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Disputed' as const },
  },
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

function focusableIn(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
}

beforeEach(() => {
  mockOpenDispute.mockReset();
  mockResolveDispute.mockReset();
  walletState.publicKey = FARMER;
});

describe('accessibility: automated scan (axe-core) on dispute-resolution UI', () => {
  it('OpenDisputeForm reports no critical/serious violations', async () => {
    const { container } = render(
      <OpenDisputeForm campaignId="42" farmerAddress={FARMER} />,
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it('CampaignAdminPanel (Disputed / ResolveDisputeForm) reports no critical/serious violations', async () => {
    const { container } = render(
      <CampaignAdminPanel overview={DISPUTED_OVERVIEW} />,
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });
});

describe('accessibility: keyboard navigation through the dispute-resolution flow', () => {
  it('tabs through OpenDisputeForm in order: reason textarea, then submit', () => {
    render(<OpenDisputeForm campaignId="42" farmerAddress={FARMER} />);

    const form = screen.getByRole('form', { name: /open a dispute/i });
    const focusable = focusableIn(form);

    expect(focusable).toHaveLength(2);
    expect(focusable[0]).toHaveAccessibleName(/reason/i);
    expect(focusable[0].tagName).toBe('TEXTAREA');
    expect(focusable[1]).toHaveAccessibleName(/open dispute/i);
    expect(focusable[1].tagName).toBe('BUTTON');
  });

  it('announces an OpenDisputeForm validation error via role="alert" without touching the mouse', () => {
    render(<OpenDisputeForm campaignId="42" farmerAddress={FARMER} />);

    const reason = screen.getByLabelText(/reason/i);
    fireEvent.submit(reason.closest('form')!);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('id', 'dispute-reason-error');
    expect(alert).toHaveTextContent(/enter a reason for the dispute/i);
    expect(reason).toHaveAttribute('aria-describedby', 'dispute-reason-error');
    expect(reason).toHaveAttribute('aria-invalid', 'true');
  });

  it('announces OpenDisputeForm success via role="status" after keyboard submit', async () => {
    mockOpenDispute.mockResolvedValueOnce(undefined);
    render(<OpenDisputeForm campaignId="42" farmerAddress={FARMER} />);

    const reason = screen.getByLabelText(/reason/i);
    fireEvent.change(reason, {
      target: { value: 'Harvest outcome does not match the report.' },
    });
    fireEvent.submit(reason.closest('form')!);

    expect(await screen.findByRole('status')).toHaveTextContent(
      /dispute opened/i,
    );
  });

  it('tabs through ResolveDisputeForm in order: resolution, payout, submit', async () => {
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    const form = screen.getByRole('form', { name: /resolve dispute/i });
    fireEvent.change(screen.getByLabelText(/resolution/i), {
      target: { value: 'PartialSettlement' },
    });

    const payout = await screen.findByLabelText(/payout to farmer/i);
    const focusable = focusableIn(form);

    expect(focusable.map((el) => el.tagName)).toEqual([
      'SELECT',
      'INPUT',
      'BUTTON',
    ]);
    expect(focusable[0]).toHaveAccessibleName(/resolution/i);
    expect(payout).toBe(focusable[1]);
    expect(focusable[2]).toHaveAccessibleName(/resolve dispute/i);
  });

  it('announces a ResolveDisputeForm validation error via role="alert" without touching the mouse', async () => {
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    const resolution = screen.getByLabelText(/resolution/i);
    fireEvent.change(resolution, { target: { value: 'PartialSettlement' } });

    const payout = await screen.findByLabelText(/payout to farmer/i);
    fireEvent.change(payout, { target: { value: '1000' } });
    fireEvent.submit(payout.closest('form')!);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('id', 'resolve-dispute-error');
    expect(alert).toHaveTextContent(
      /partial settlement payout must be greater than zero/i,
    );
    expect(payout).toHaveAttribute('aria-invalid', 'true');
    expect(payout).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('resolve-dispute-error'),
    );
    expect(mockResolveDispute).not.toHaveBeenCalled();
  });

  it('announces ResolveDisputeForm success via role="status" after keyboard submit', async () => {
    mockResolveDispute.mockResolvedValueOnce(undefined);
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    const form = screen.getByRole('form', { name: /resolve dispute/i });
    fireEvent.submit(form);

    expect(await screen.findByRole('status')).toHaveTextContent(
      /dispute resolved/i,
    );
  });
});
