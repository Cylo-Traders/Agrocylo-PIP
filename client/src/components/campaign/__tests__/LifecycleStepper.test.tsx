import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LifecycleStepper } from '../LifecycleStepper';

function currentStepText(): string {
  const current = document.querySelector('[aria-current="step"]');
  expect(current).not.toBeNull();
  return current!.parentElement?.textContent ?? '';
}

describe('LifecycleStepper', () => {
  it('keeps a Funded campaign with no released tranches on the Funded step', () => {
    render(
      <LifecycleStepper
        status="Funded"
        tranches={[{ released: false }]}
        releasedAmount={0n}
      />,
    );

    expect(currentStepText()).toMatch(/Funded/);
    expect(currentStepText()).not.toMatch(/In Production/);
    expect(screen.getByText('In Production')).toBeInTheDocument();
  });

  it('advances a Funded campaign with a released tranche to In Production', () => {
    render(
      <LifecycleStepper
        status="Funded"
        tranches={[{ released: true }, { released: false }]}
      />,
    );

    expect(currentStepText()).toMatch(/In Production/);
  });

  it('advances a Funded campaign with releasedAmount > 0 to In Production', () => {
    render(<LifecycleStepper status="Funded" releasedAmount={250n} />);

    expect(currentStepText()).toMatch(/In Production/);
  });

  it('uses the on-chain InProduction tag for the production step', () => {
    render(<LifecycleStepper status="InProduction" />);

    expect(currentStepText()).toMatch(/In Production/);
  });
});
