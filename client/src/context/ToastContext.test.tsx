import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastContext';

function Probe() {
  const toast = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast.success('Saved', 'All good')}>
        Success
      </button>
      <button
        type="button"
        onClick={() => toast.error('Failed', 'Something broke')}
      >
        Failure
      </button>
    </div>
  );
}

describe('ToastProvider', () => {
  it('renders a success toast and allows dismissal', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Success' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('status')).toHaveTextContent('All good');

    await user.click(
      screen.getByRole('button', { name: /dismiss notification/i }),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders an error toast with role="alert"', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Failure' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke');
  });

  it('throws when useToast is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /useToast must be used within a ToastProvider/,
    );
    spy.mockRestore();
  });
});
