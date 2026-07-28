import { Component, type ErrorInfo, type ReactNode } from 'react';
import './ErrorBoundary.css';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback. Receives the error and a reset handler. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches uncaught render errors in the subtree and shows a friendly fallback
 * instead of a blank white screen.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a console breadcrumb for developers; avoid noisy production logs.
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught a render error:', error, info);
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="ui-error-boundary" role="alert">
        <div className="ui-error-boundary__card">
          <p className="ui-error-boundary__eyebrow">Something went wrong</p>
          <h1 className="ui-error-boundary__title">
            This page hit an unexpected error
          </h1>
          <p className="ui-error-boundary__body">
            You can try again, or go back and continue from another screen. If
            this keeps happening, reload the app.
          </p>
          {import.meta.env.DEV && (
            <pre className="ui-error-boundary__detail">{error.message}</pre>
          )}
          <div className="ui-error-boundary__actions">
            <button
              type="button"
              className="ui-error-boundary__primary"
              onClick={this.reset}
            >
              Try again
            </button>
            <button
              type="button"
              className="ui-error-boundary__secondary"
              onClick={() => {
                window.location.assign('/');
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
