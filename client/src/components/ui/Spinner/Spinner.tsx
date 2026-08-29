import React from 'react';
import './Spinner.css';

/**
 * Props for the Spinner component.
 */
export interface SpinnerProps {
  /**
   * The size of the spinner.
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * The color variant of the spinner.
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'light';
  /**
   * Custom CSS class name to append.
   */
  className?: string;
  /**
   * Accessible name announced by screen readers. Pass `null` when the spinner
   * sits inside an element that already carries `role="status"` (or another
   * live region) — nesting two status regions makes screen readers announce
   * the same loading state twice, and leaves `getByRole('status')` ambiguous.
   * @default 'loading'
   */
  label?: string | null;
}

/**
 * Spinner component used to display a loading state.
 *
 * @example
 * ```tsx
 * <Spinner size="md" variant="primary" />
 * ```
 *
 * @example Decorative — the parent already announces the loading state.
 * ```tsx
 * <div role="status" aria-label="Loading activity">
 *   <Spinner label={null} />
 * </div>
 * ```
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  className = '',
  label = 'loading',
}) => {
  const classes = `ui-spinner ui-spinner--${size} ui-spinner--${variant} ${className}`;

  if (label === null) {
    return <div aria-hidden="true" className={classes} />;
  }

  return (
    <div role="status" aria-label={label} className={classes}>
      <span className="ui-spinner-sr-only">Loading...</span>
    </div>
  );
};
