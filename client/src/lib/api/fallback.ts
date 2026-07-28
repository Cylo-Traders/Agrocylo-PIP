/**
 * Local fallback dataset served when the backend API is disabled
 * (`VITE_USE_BACKEND_API` off) or unreachable / not implemented yet. This keeps
 * dashboards and activity feeds rendering against realistic, schema-shaped data
 * before the backend ships its REST endpoints.
 *
 * The records here mirror the response DTOs in `types.ts` exactly (BigInt
 * columns as decimal strings, DateTime columns as ISO strings), so swapping to
 * real backend data is a no-op for consumers.
 */
import type { Campaign, Investment, Order, Transaction, User } from './types';

const FARMER_ADDRESS =
  'GFARMER00000000000000000000000000000000000000000000000A1';
const INVESTOR_ADDRESS =
  'GINVESTOR000000000000000000000000000000000000000000000B2';
const BUYER_ADDRESS =
  'GBUYER0000000000000000000000000000000000000000000000000C3';
const TOKEN_ADDRESS =
  'CTOKEN0000000000000000000000000000000000000000000000000D4';

const CAMPAIGNS: readonly Campaign[] = [
  {
    id: 'camp-101',
    farmer: FARMER_ADDRESS,
    title: 'Organic Maize Irrigation & Harvesting PIP',
    description:
      'Drip irrigation and harvesting for a 40-acre organic maize farm.',
    targetAmount: '10000',
    tokenAddress: TOKEN_ADDRESS,
    deadline: '1793000000',
    status: 'Funding',
    totalFunded: '2500',
    escrowContract: 'CESCROW000000000000000000000000000000000000000000000101',
    trancheCount: 3,
    harvestOutcome: null,
    harvestReportedAt: null,
    refundable: '0',
    createdAt: '1789000000',
    updatedAt: '2026-07-15T10:00:00.000Z',
  },
  {
    id: 'camp-102',
    farmer: FARMER_ADDRESS,
    title: 'Solar-Powered Cold Chain Logistics PIP',
    description: 'Solar cold storage to reduce post-harvest losses in transit.',
    targetAmount: '5000',
    tokenAddress: TOKEN_ADDRESS,
    deadline: '1788000000',
    status: 'Settled',
    totalFunded: '5000',
    escrowContract: 'CESCROW000000000000000000000000000000000000000000000102',
    trancheCount: 2,
    harvestOutcome: 'Success',
    harvestReportedAt: '1790500000',
    refundable: '0',
    createdAt: '1785000000',
    updatedAt: '2026-06-01T14:30:00.000Z',
  },
  {
    id: 'camp-103',
    farmer: FARMER_ADDRESS,
    title: 'Bio-Organic Fertilizer Expansion PIP',
    description: 'Scaling a bio-organic fertilizer line for smallholder farms.',
    targetAmount: '4000',
    tokenAddress: TOKEN_ADDRESS,
    deadline: '1787000000',
    status: 'Failed',
    totalFunded: '1500',
    escrowContract: 'CESCROW000000000000000000000000000000000000000000000103',
    trancheCount: null,
    harvestOutcome: null,
    harvestReportedAt: null,
    refundable: '1500',
    createdAt: '1783000000',
    updatedAt: '2026-05-20T09:15:00.000Z',
  },
];

const INVESTMENTS: readonly Investment[] = [
  {
    id: 'inv-1',
    campaignId: 'camp-101',
    investor: INVESTOR_ADDRESS,
    amount: '2500',
    txHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00',
    timestamp: '1789100000',
    createdAt: '2026-07-15T10:05:00.000Z',
  },
  {
    id: 'inv-2',
    campaignId: 'camp-102',
    investor: INVESTOR_ADDRESS,
    amount: '5000',
    txHash: 'b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff0011',
    timestamp: '1785200000',
    createdAt: '2026-06-01T14:35:00.000Z',
  },
  {
    id: 'inv-3',
    campaignId: 'camp-103',
    investor: INVESTOR_ADDRESS,
    amount: '1500',
    txHash: null,
    timestamp: '1783300000',
    createdAt: '2026-05-20T09:20:00.000Z',
  },
];

const ORDERS: readonly Order[] = [
  {
    id: 'order-1',
    campaignId: 'camp-102',
    buyer: BUYER_ADDRESS,
    amount: '1000',
    status: 'Confirmed',
    confirmedAt: '1790600000',
    txHash: 'c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff001122',
    createdAt: '2026-06-10T08:00:00.000Z',
    updatedAt: '2026-06-11T08:00:00.000Z',
  },
  {
    id: 'order-2',
    campaignId: 'camp-101',
    buyer: BUYER_ADDRESS,
    amount: '500',
    status: 'Pending',
    confirmedAt: null,
    txHash: null,
    createdAt: '2026-07-16T08:00:00.000Z',
    updatedAt: '2026-07-16T08:00:00.000Z',
  },
];

const USERS: readonly User[] = [
  {
    address: INVESTOR_ADDRESS,
    name: 'Demo Investor',
    firstSeenAt: '1783300000',
    createdAt: '2026-05-20T09:20:00.000Z',
    updatedAt: '2026-07-15T10:05:00.000Z',
  },
  {
    address: FARMER_ADDRESS,
    name: 'Demo Farmer',
    firstSeenAt: '1783000000',
    createdAt: '2026-05-20T09:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
  },
];

const TRANSACTIONS: readonly Transaction[] = [
  {
    id: 'tx-1',
    type: 'Investment',
    campaignId: 'camp-101',
    userId: INVESTOR_ADDRESS,
    amount: '2500',
    txHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00',
    status: 'Confirmed',
    timestamp: '1789100000',
    data: '{}',
    createdAt: '2026-07-15T10:05:00.000Z',
  },
  {
    id: 'tx-2',
    type: 'Refund',
    campaignId: 'camp-103',
    userId: INVESTOR_ADDRESS,
    amount: '1500',
    txHash: null,
    status: 'Pending',
    timestamp: '1783300000',
    data: '{"reason":"campaign_failed"}',
    createdAt: '2026-05-20T09:20:00.000Z',
  },
];

/** Deep clone so callers can't mutate the shared fallback dataset. */
function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export const localData = {
  campaigns(): Campaign[] {
    return clone([...CAMPAIGNS]);
  },
  campaign(id: string): Campaign | undefined {
    return clone(CAMPAIGNS.find((c) => c.id === id));
  },
  campaignInvestments(campaignId: string): Investment[] {
    return clone(INVESTMENTS.filter((i) => i.campaignId === campaignId));
  },
  investmentsByUser(address: string): Investment[] {
    return clone(INVESTMENTS.filter((i) => i.investor === address));
  },
  campaignOrders(campaignId: string): Order[] {
    return clone(ORDERS.filter((o) => o.campaignId === campaignId));
  },
  order(id: string): Order | undefined {
    return clone(ORDERS.find((o) => o.id === id));
  },
  user(address: string): User | undefined {
    return clone(USERS.find((u) => u.address === address));
  },
  transactionsByUser(address: string): Transaction[] {
    return clone(TRANSACTIONS.filter((t) => t.userId === address));
  },
};
