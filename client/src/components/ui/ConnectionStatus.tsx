import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConnectionType = 'local' | 'cloud' | 'live-tracking';

export interface ConnectionStatusProps {
  type: ConnectionType;
  isConnected: boolean;
  isPending?: boolean;
  hasError?: boolean;
  className?: string;
  showLabel?: boolean;
  variant?: 'default' | 'compact' | 'badge' | 'inline';
  customLabel?: string;
}

export function ConnectionStatus({
  type,
  isConnected,
  isPending = false,
  hasError = false,
  className,
  showLabel = true,
  variant = 'default',
  customLabel
}: ConnectionStatusProps) {
  const getStatusIcon = () => {
    if (isPending) {
      return <Wifi className="h-4 w-4 animate-pulse text-amber-500" />;
    }
    
    if (hasError) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    
    if (isConnected) {
      return <Wifi className="h-4 w-4 text-green-500" />;
    }
    
    return <WifiOff className="h-4 w-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (customLabel) {
      return customLabel;
    }

    if (isPending) {
      return 'Connecting...';
    }
    
    if (hasError) {
      return 'Error';
    }
    
    if (isConnected) {
      switch (type) {
        case 'local':
          return 'Connected';
        case 'cloud':
          return 'Connected';
        case 'live-tracking':
          return 'Connected';
        default:
          return 'Connected';
      }
    }
    
    return 'Offline';
  };

  const getStatusColor = () => {
    if (isPending) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    
    if (hasError) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    
    if (isConnected) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getLabel = () => {
    switch (type) {
      case 'local':
        return 'Local Network';
      case 'cloud':
        return 'Cloud Server';
      case 'live-tracking':
        return 'Live Tracking';
      default:
        return 'Connection';
    }
  };

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {getStatusIcon()}
        {showLabel && (
          <span className="text-sm font-medium">
            {getLabel()}: {getStatusText()}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <Badge className={cn(getStatusColor(), className)} variant="outline">
        <div className="flex items-center gap-1">
          {getStatusIcon()}
          {showLabel && (
            <span className="text-xs">
              {getLabel()}: {getStatusText()}
            </span>
          )}
        </div>
      </Badge>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="relative flex h-2.5 w-2.5">
          {isConnected && !hasError && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          )}
          <span
            className={cn(
              'relative inline-flex rounded-full h-2.5 w-2.5',
              isConnected && !hasError ? 'bg-green-500' : 
              hasError ? 'bg-red-500' : 
              isPending ? 'bg-amber-500' : 'bg-gray-400'
            )}
          ></span>
        </div>
        {showLabel && (
          <span className="text-sm font-medium text-foreground/80">
            {getLabel()}: {getStatusText()}
          </span>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {getStatusIcon()}
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground/80 lowercase sm:uppercase">
          {getLabel()}
        </span>
        <span className={cn(
          'font-medium',
          isConnected && !hasError ? 'text-green-600' : 
          hasError ? 'text-red-600' : 
          isPending ? 'text-amber-600' : 'text-gray-600'
        )}>
          {getStatusText()}
        </span>
      </div>
    </div>
  );
}

export default ConnectionStatus;
