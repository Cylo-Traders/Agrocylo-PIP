import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ blowUp }: { blowUp: boolean }) {
  if (blowUp) {
    throw new Error('boom from render');
  }
  return <p>healthy content</p>;
}

describe('ErrorBoundary', () => {
  it('shows a friendly fallback instead of a blank screen', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom blowUp />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/this page hit an unexpected error/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('healthy content')).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it('can recover via Try again', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    let blowUp = true;

    const { rerender } = render(
      <ErrorBoundary>
        <Boom blowUp={blowUp} />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText(/this page hit an unexpected error/i),
    ).toBeInTheDocument();

    // Update the child prop first, then reset the boundary so the remount
    // renders the healthy tree instead of throwing again.
    blowUp = false;
    rerender(
      <ErrorBoundary>
        <Boom blowUp={blowUp} />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('healthy content')).toBeInTheDocument();
    spy.mockRestore();
  });
});
