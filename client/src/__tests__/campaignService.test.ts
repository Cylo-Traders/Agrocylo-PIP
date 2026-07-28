import {
  validateContribution,
  calculateOwnershipShare,
  fundCampaign,
} from '../lib/soroban/campaignService';

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Expected true, got false');
  }
}

// 1. Validation Tests
const validRes = validateContribution(500, 1000);
assertEqual(validRes.valid, true);

const zeroRes = validateContribution(0, 1000);
assertEqual(zeroRes.valid, false);
assertEqual(zeroRes.error, 'Contribution amount must be greater than zero');

const negativeRes = validateContribution(-50, 1000);
assertEqual(negativeRes.valid, false);

const exceedsRes = validateContribution(1500, 1000);
assertEqual(exceedsRes.valid, false);
assertTrue(!!exceedsRes.error?.includes('exceeds remaining target'));

// 2. Ownership Share Calculation Tests
assertEqual(calculateOwnershipShare(2500, 10000), 25);
assertEqual(calculateOwnershipShare(5000, 10000), 50);
assertEqual(calculateOwnershipShare(0, 10000), 0);

// 3. Fund Campaign Execution Tests
fundCampaign(
  { campaignId: 'c1', amount: 1000, walletAddress: 'GUSER' },
  2000,
  10000,
).then((res) => {
  assertEqual(res.success, true);
  assertTrue(!!res.txHash?.startsWith('0x'));
  assertEqual(res.newTotalRaised, 3000);
  assertEqual(res.newRemainingTarget, 7000);
});
