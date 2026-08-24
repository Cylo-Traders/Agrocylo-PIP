import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenDisputeForm } from '../OpenDisputeForm';
import type { Dispute } from '../../../lib/soroban/types';

const FARMER = 'GFARMER0000000000000000000000000000000000000000000000000';
const CONTRIBUTOR = 'GINVESTOR000000000000000000000000000000000000000000000';
const ADMIN = 'GADMIN00000000000000000000000000000000000000000000000000';
const STRANGER = 'GSTRANGER00000000000000000000000000000000000000000000000';

const mockOpenDispute = vi.fn();
let mockPublicKey: string | null = FARMER;
let mockContribution = 0n;
let mockAdmin: string | undefined = ADMIN;
let mockDispute: Dispute | undefined;

vi.mock('../../../context/WalletContext', () => ({
  useWallet: () => ({ publicKey: mockPublicKey }),
}));

vi.mock('../../../hooks/contract', () => ({
  useOpenDispute: () => ({ mutateAsync: mockOpenDispute, isPending: false }),
  useContribution: () => ({ data: mockContribution }),
  useEscrowAdmin: () => ({ data: mockAdmin }),
  useDispute: () => ({ data: mockDispute }),
}));

beforeEach(() => {
  mockOpenDispute.mockReset();
  mockPublicKey = FARMER;
  mockContribution = 0n;
  mockAdmin = ADMIN;
  mockDispute = undefined;
});

describe('OpenDisputeForm', () => {
  it('prompts to connect a wallet when none is connected', () => {
    mockPublicKey = null;
    render(<OpenDisputeForm campaignId="42" farmerAddress={FARMER} />);

    expect(
      screen.getByText(/connect your wallet to open a dispute/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open dispute/i })).toBeNull();
  });

  it('renders nothing for a connected wallet that is not the farmer, a contributor, or the admin', () => {
    mockPublicKey = STRANGER;
    mockContribution = 0n;
    const { container } = render(
      <OpenDisputeForm campaignId="42" farmerAddress={FARMER} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('lets the farmer open a dispute', async () => {
    mockPublicKey = FARMER;
    const user = userEvent.setup();
    render(<OpenDisputeForm campaignId="42" farmerAddress={FARMER} />);

    await user.type(
      screen.getByLabelText(/reason/i),
      'Harvest outcome does not match the report.',
    );
    await user.click(screen.getByRole('button', { name: /open dispute/i }));

    expect(mockOpenDispute).toHaveBeenCalledWith({
      campaignId: '42',
      opener: FARMER,
      reason: 'Harvest outcome does not match the report.',
    });
    expect(await screen.findByText(/dispute opened/i)).toBeInTheDocument();
  });

  it('lets a contributing investor open a dispute', async () => {
    mockPublicKey = CONTRIBUTOR;
    mockContribution = 500n;
    const user = userEvent.setup();
    render(<OpenDisputeForm campaignId="42" farmerAddress={FARMER} />);

    await user.type(screen.getByLabelText(/reason/i), 'Funds not released.');
    await user.click(screen.getByRole('button', { name: /open dispute/i }));

    expect(mockOpenDispute).toHaveBeenCalledWith({
      campaignId: '42',
      opener: CONTRIBUTOR,
      reason: 'Funds not released.',
    });
  });

  it('lets the admin open a dispute', async () => {
    mockPublicKey = ADMIN;
    mockContribution = 0n;
    const user = userEvent.setup();
    render(<OpenDisputeForm campaignId="42" farmerAddress={FARMER} />);

    await user.type(
      screen.getByLabelText(/reason/i),
      'Investigating on behalf of a reporter.',
    );
    await user.click(screen.getByRole('button', { name: /open dispute/i }));

    expect(mockOpenDispute).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty reason client-side and does not call the mutation', async () => {
    const user = userEvent.setup();
    render(<OpenDisputeForm campaignId="42" farmerAddress={FARMER} />);

    await user.click(screen.getByRole('button', { name: /open dispute/i }));

    expect(
      await screen.findByText(/enter a reason for the dispute/i),
    ).toBeInTheDocument();
    expect(mockOpenDispute).not.toHaveBeenCalled();
  });

  it('surfaces a contract-level rejection as a readable error without clearing the form', async () => {
    mockOpenDispute.mockRejectedValueOnce(
      new Error(
        'HostError: Error(Contract, #7)\nlong diagnostic dump that should be truncated',
      ),
    );
    const user = userEvent.setup();
    render(<OpenDisputeForm campaignId="42" farmerAddress={FARMER} />);

    const reasonInput = screen.getByLabelText(/reason/i);
    await user.type(reasonInput, 'Disputing harvest outcome.');
    await user.click(screen.getByRole('button', { name: /open dispute/i }));

    expect(
      await screen.findByText(/HostError: Error\(Contract, #7\)/),
    ).toBeInTheDocument();
    expect(reasonInput).toHaveValue('Disputing harvest outcome.');
  });

  it('does not render the open-dispute form when a dispute is already Open', () => {
    mockDispute = {
      campaign_id: 42n,
      opener: FARMER,
      reason: 'Harvest_delay',
      timestamp: 0n,
      ledger_sequence: 0,
      status: { tag: 'Open' },
      resolution: { tag: 'Pending' },
    };
    render(<OpenDisputeForm campaignId="42" farmerAddress={FARMER} />);

    expect(
      screen.getByText(
        /a dispute is already open on this campaign — an admin needs to resolve it/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/reason/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /open dispute/i })).toBeNull();
  });
});
