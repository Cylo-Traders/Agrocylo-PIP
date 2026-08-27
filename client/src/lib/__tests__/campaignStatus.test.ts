/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACTIONABLE_STATUSES,
  isDerivedInProduction,
  lifecycleStepIndex,
  LIFECYCLE_STEPS,
  presentationalCampaignStatus,
} from '../campaignStatus';
import { ON_CHAIN_CAMPAIGN_STATUS_TAGS } from '../soroban/types';
import type { CampaignStatusTag } from '../soroban/types';

const TYPES_RS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../contracts/production_escrow/src/types.rs',
);

function parseRustEnumVariants(source: string, enumName: string): string[] {
  const match = source.match(
    new RegExp(`pub enum ${enumName}\\s*\\{([^}]+)\\}`),
  );
  if (!match) {
    throw new Error(`pub enum ${enumName} not found in ${TYPES_RS}`);
  }
  return [...match[1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*,?/gm)].map(
    (m) => m[1],
  );
}

describe('CampaignStatusTag vs production_escrow CampaignStatus', () => {
  it('stays in lockstep with contracts/production_escrow/src/types.rs', () => {
    const rustVariants = parseRustEnumVariants(
      readFileSync(TYPES_RS, 'utf8'),
      'CampaignStatus',
    );

    expect(rustVariants).toEqual([...ON_CHAIN_CAMPAIGN_STATUS_TAGS]);
  });

  it('only lists on-chain tags in ACTIONABLE_STATUSES', () => {
    const onChain = new Set<string>(ON_CHAIN_CAMPAIGN_STATUS_TAGS);
    for (const status of ACTIONABLE_STATUSES) {
      expect(onChain.has(status)).toBe(true);
    }
  });
});

describe('derived in-production (Funded + released tranche)', () => {
  it('is not derived from Funded alone', () => {
    expect(isDerivedInProduction('Funded')).toBe(false);
    expect(
      isDerivedInProduction('Funded', {
        tranches: [{ released: false }, { released: false }],
        releasedAmount: 0n,
      }),
    ).toBe(false);
    expect(presentationalCampaignStatus('Funded')).toBe('Funded');
  });

  it('derives from Funded when some tranche is released', () => {
    const progress = {
      tranches: [{ released: false }, { released: true }],
    };
    expect(isDerivedInProduction('Funded', progress)).toBe(true);
    expect(presentationalCampaignStatus('Funded', progress)).toBe(
      'InProduction',
    );
  });

  it('derives from Funded when campaign.released is greater than zero', () => {
    expect(isDerivedInProduction('Funded', { releasedAmount: 500n })).toBe(
      true,
    );
    expect(presentationalCampaignStatus('Funded', { releasedAmount: 1 })).toBe(
      'InProduction',
    );
  });

  it('does not override a later on-chain status', () => {
    const later: CampaignStatusTag[] = [
      'Harvested',
      'Disputed',
      'Resolved',
      'Settled',
      'Failed',
    ];
    for (const status of later) {
      expect(
        isDerivedInProduction(status, {
          tranches: [{ released: true }],
          releasedAmount: 1n,
        }),
      ).toBe(false);
      expect(
        presentationalCampaignStatus(status, {
          tranches: [{ released: true }],
        }),
      ).toBe(status);
    }
  });

  it('advances the lifecycle stepper to In Production for Funded + released tranche', () => {
    const productionIndex = LIFECYCLE_STEPS.findIndex(
      (step) => step.key === 'production',
    );
    const fundedIndex = LIFECYCLE_STEPS.findIndex(
      (step) => step.key === 'funded',
    );

    expect(lifecycleStepIndex('Funded')).toBe(fundedIndex);
    expect(
      lifecycleStepIndex('Funded', {
        tranches: [{ released: true }],
      }),
    ).toBe(productionIndex);
    expect(lifecycleStepIndex('Funded', { releasedAmount: 100n })).toBe(
      productionIndex,
    );
    expect(lifecycleStepIndex('InProduction')).toBe(productionIndex);
  });
});
