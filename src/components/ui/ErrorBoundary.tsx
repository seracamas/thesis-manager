import { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { resetDatabase } from '../../utils/db';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  isResetting?: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    isResetting: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleResetDatabase = async () => {
    if (confirm('⚠️ WARNING: This will delete ALL your data. This cannot be undone. Continue?')) {
      this.setState({ isResetting: true });
      try {
        await resetDatabase();
        // resetDatabase will reload the page, so we don't need to do anything else
      } catch (err) {
        console.error('Failed to reset database:', err);
        this.setState({ isResetting: false });
        // Force reload anyway
        window.location.reload();
      }
    }
  };

  private isDatabaseError = (error?: Error): boolean => {
    if (!error) return false;
    return (
      error.name === 'ConstraintError' ||
      error.name === 'VersionError' ||
      error.message?.includes('index') ||
      error.message?.includes('already exists') ||
      error.message?.includes('Database') ||
      error.message?.includes('schema')
    );
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDbError = this.isDatabaseError(this.state.error);

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-text-primary text-text-primary mb-4">
              {isDbError ? 'Database Error' : 'Something went wrong'}
            </h2>
            <p className="text-text-secondary text-text-secondary mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            {isDbError && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                  <strong>Database schema conflict detected.</strong>
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  This usually happens after a code update. Resetting the database will fix it, but all your data will be deleted.
                </p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {isDbError && (
                <Button
                  variant="danger"
                  onClick={this.handleResetDatabase}
                  disabled={this.state.isResetting}
                >
                  {this.state.isResetting ? 'Resetting Database...' : 'Reset Database & Reload'}
                </Button>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    this.setState({ hasError: false, error: undefined });
                    window.location.reload();
                  }}
                >
                  Reload Page
                </Button>
                {!isDbError && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      this.setState({ hasError: false, error: undefined });
                    }}
                  >
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
