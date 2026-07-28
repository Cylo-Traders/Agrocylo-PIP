/**
 * Typed shapes for the backend REST API, mirroring the Prisma models in
 * `server/prisma/schema.prisma` (`Campaign`, `Investment`, `Order`, `User`,
 * `Transaction`).
 *
 * JSON has no BigInt, so every Prisma `BigInt` column is transported as a
 * decimal `string` over the wire (this is the conventional, lossless way to
 * serialize on-chain amounts / ledger timestamps). Prisma `DateTime` columns
 * are transported as ISO-8601 `string`s. Callers that need arithmetic should
 * convert with `BigInt(value)` at the edge.
 *
 * These are the *response* DTOs (scalar fields only). Relation fields
 * (`campaign.investments`, `user.transactions`, ...) are exposed through
 * dedicated client functions rather than nested includes, keeping the default
 * payloads small and predictable.
 */

/** BigInt-valued column serialized as a decimal string (e.g. "10000"). */
export type NumericString = string;

/** ISO-8601 timestamp string (e.g. "2026-07-25T10:00:00.000Z"). */
export type IsoDateString = string;

/**
 * Mirrors Prisma `Campaign`. `status` is a free-form string in the schema;
 * known values today are Active | Funding | Funded | InProduction | Harvested
 * | Disputed | Resolved | Settled | Failed.
 */
export interface Campaign {
  id: string;
  farmer: string;
  title: string;
  description: string;
  targetAmount: NumericString | null;
  tokenAddress: string | null;
  deadline: NumericString | null;
  status: string;
  totalFunded: NumericString;
  escrowContract: string;
  trancheCount: number | null;
  harvestOutcome: string | null;
  harvestReportedAt: NumericString | null;
  refundable: NumericString | null;
  createdAt: NumericString;
  updatedAt: IsoDateString;
}

/** Mirrors Prisma `Investment`. */
export interface Investment {
  id: string;
  campaignId: string;
  investor: string;
  amount: NumericString;
  txHash: string | null;
  timestamp: NumericString | null;
  createdAt: IsoDateString;
}

/**
 * Mirrors Prisma `Order`. `status` known values today: Pending | Confirmed |
 * Cancelled.
 */
export interface Order {
  id: string;
  campaignId: string | null;
  buyer: string;
  amount: NumericString | null;
  status: string;
  confirmedAt: NumericString | null;
  txHash: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** Mirrors Prisma `User` (keyed by Stellar `address`). */
export interface User {
  address: string;
  name: string | null;
  firstSeenAt: NumericString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/**
 * Mirrors Prisma `Transaction`. `data` is a JSON string blob. `status` known
 * values today: Pending | Confirmed | Failed.
 */
export interface Transaction {
  id: string;
  type: string;
  campaignId: string | null;
  userId: string | null;
  amount: NumericString | null;
  txHash: string | null;
  status: string;
  timestamp: NumericString | null;
  data: string;
  createdAt: IsoDateString;
}
