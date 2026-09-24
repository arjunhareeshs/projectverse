import React from 'react';
import { reportCaughtError } from '../utils/errorReporting';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportCaughtError(error.message, error.stack || info.componentStack || undefined);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background text-center px-6">
          <p className="text-lg font-bold text-foreground">Something went wrong.</p>
          <p className="text-sm text-muted-foreground">
            The error has been reported. Try reloading the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
