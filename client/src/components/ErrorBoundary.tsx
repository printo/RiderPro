import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log to external monitoring service (placeholder)
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // This would integrate with monitoring services like Sentry, LogRocket, etc.
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    // For now, just console.error (in production, send to monitoring service)
    console.error('RiderPro Error:', errorData);
    
    // Could also send to API endpoint for logging
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData),
    }).catch(() => {
      // Silently fail if error logging fails
    });
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

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

    return this.props.children;
  }
}

export default ErrorBoundary;