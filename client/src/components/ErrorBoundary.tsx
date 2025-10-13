import React, { Component, ErrorInfo, ReactNode, ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react";
import { apiClient } from "@/services/ApiClient";

// Enhanced Props interface with context-aware options
interface Props {
  children: ReactNode;
  fallback?: ReactNode;

  // Context-specific options
  variant?: 'page' | 'component' | 'modal' | 'chart' | 'listItem';
  componentVariant?: 'inline' | 'card' | 'minimal';
  componentName?: string;
  pageName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentName = this.props.componentName || 'Unknown Component';
    console.error(`ErrorBoundary (${componentName}) caught an error:`, error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to external monitoring service
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Enhanced error data with component context
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      componentName: this.props.componentName,
      variant: this.props.variant,
      pageName: this.props.pageName,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error('RiderPro Error:', errorData);

    // Send to API endpoint for logging
    apiClient.post('/api/errors', errorData).catch(() => {
      // Silently fail if error logging fails
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleGoBack = () => {
    window.history.back();
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Context-aware error rendering based on variant
      return this.renderErrorByVariant();
    }

    return this.props.children;
  }

  private renderErrorByVariant() {
    const { variant = 'page', componentVariant = 'inline', componentName, pageName } = this.props;

    switch (variant) {
      case 'page':
        return this.renderPageError(pageName || componentName || 'Page');

      case 'component':
        return this.renderComponentError(componentName || 'Component', componentVariant);

      case 'modal':
        return this.renderModalError();

      case 'chart':
        return this.renderChartError();

      case 'listItem':
        return this.renderListItemError();

      default:
        return this.renderDefaultError();
    }
  }

  private renderPageError(pageName: string) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Page Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground">
                The <strong>{pageName}</strong> page encountered an error and couldn't load properly.
              </p>
              {this.state.error?.message && (
                <p className="text-sm text-muted-foreground mt-2 font-mono bg-muted p-2 rounded">
                  {this.state.error.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={this.handleRetry} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={this.handleGoBack} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
                <Button variant="outline" onClick={this.handleGoHome} className="flex-1">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  private renderComponentError(componentName: string, variant: 'inline' | 'card' | 'minimal') {
    if (variant === 'minimal') {
      return (
        <div className="p-2 text-center text-muted-foreground">
          <p className="text-sm">Unable to load {componentName}</p>
          <Button variant="ghost" size="sm" onClick={this.handleRetry} className="mt-1">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      );
    }

    if (variant === 'card') {
      return (
        <Card className="border-destructive/20">
          <CardContent className="pt-4">
            <div className="text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <div>
                <h3 className="font-medium text-sm">{componentName} Error</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  This component failed to load
                </p>
              </div>
              <Button size="sm" onClick={this.handleRetry}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Default: inline variant
    return (
      <Alert variant="destructive" className="my-2">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{componentName} failed to load</span>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  private renderModalError() {
    return (
      <div className="p-6 text-center space-y-4">
        <div className="bg-destructive/10 p-3 rounded-lg inline-block">
          <AlertTriangle className="text-destructive h-6 w-6" />
        </div>

        <div>
          <h3 className="font-medium">Modal Error</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This dialog encountered an error
          </p>
        </div>

        <div className="flex gap-2 justify-center">
          <Button size="sm" onClick={this.handleRetry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  private renderChartError() {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-muted-foreground/20 rounded-lg">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-medium text-sm">Chart Error</h3>
            <p className="text-xs text-muted-foreground">Unable to render visualization</p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Reload Chart
          </Button>
        </div>
      </div>
    );
  }

  private renderListItemError() {
    return (
      <div className="p-3 border border-destructive/20 rounded-lg bg-destructive/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-muted-foreground">Item failed to load</span>
          </div>
          <Button variant="ghost" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  private renderDefaultError() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="bg-destructive/10 p-3 rounded-lg">
                  <AlertTriangle className="text-destructive h-8 w-8" />
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Something went wrong
                </h2>
                <p className="text-muted-foreground text-sm">
                  {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={this.handleRetry}
                  className="w-full"
                  data-testid="button-retry-error"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>

                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="w-full"
                  data-testid="button-reload-page"
                >
                  Reload Page
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                If the problem persists, please contact support.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;

// Higher-Order Component for easy ErrorBoundary integration
interface WithErrorBoundaryOptions {
  variant?: 'page' | 'component' | 'modal' | 'chart' | 'listItem';
  componentVariant?: 'inline' | 'card' | 'minimal';
  componentName?: string;
  pageName?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Higher-Order Component that wraps any component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
) {
  const {
    variant = 'component',
    componentVariant = 'inline',
    componentName = WrappedComponent.displayName || WrappedComponent.name || 'Component',
    pageName,
    fallback,
    onError
  } = options;

  const WithErrorBoundaryComponent = (props: P) => {
    return (
      <ErrorBoundary
        variant={variant}
        componentVariant={componentVariant}
        componentName={componentName}
        pageName={pageName}
        fallback={fallback}
        onError={onError}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${componentName})`;

  return WithErrorBoundaryComponent;
}

/**
 * Convenience functions for specific ErrorBoundary types
 */
export const withPageErrorBoundary = <P extends object>(
  Component: ComponentType<P>,
  pageName: string,
  options?: Omit<WithErrorBoundaryOptions, 'variant' | 'pageName'>
) => withErrorBoundary(Component, { ...options, variant: 'page', pageName });

export const withComponentErrorBoundary = <P extends object>(
  Component: ComponentType<P>,
  options?: Omit<WithErrorBoundaryOptions, 'variant'>
) => withErrorBoundary(Component, { ...options, variant: 'component' });

export const withModalErrorBoundary = <P extends object>(
  Component: ComponentType<P>,
  options?: Omit<WithErrorBoundaryOptions, 'variant'>
) => withErrorBoundary(Component, { ...options, variant: 'modal' });

export const withChartErrorBoundary = <P extends object>(
  Component: ComponentType<P>,
  options?: Omit<WithErrorBoundaryOptions, 'variant'>
) => withErrorBoundary(Component, { ...options, variant: 'chart' });

export const withListItemErrorBoundary = <P extends object>(
  Component: ComponentType<P>,
  options?: Omit<WithErrorBoundaryOptions, 'variant'>
) => withErrorBoundary(Component, { ...options, variant: 'listItem' });

/**
 * React Hook for error boundary functionality in functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
    console.error('Component error:', error);
  }, []);

  // Throw error to be caught by nearest ErrorBoundary
  if (error) {
    throw error;
  }

  return { handleError, resetError };
}