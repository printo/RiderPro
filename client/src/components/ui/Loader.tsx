import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
  variant?: 'default' | 'inline' | 'fullscreen';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12'
};

export function Loader({
  size = 'md',
  className,
  text,
  variant = 'default'
}: LoaderProps) {
  const spinnerClasses = cn(
    'animate-spin',
    sizeClasses[size],
    className
  );

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className={spinnerClasses} />
        {text && <span className="text-sm text-muted-foreground">{text}</span>}
      </div>
    );
  }

  if (variant === 'fullscreen') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className={cn(spinnerClasses, 'text-primary')} />
          {text && <p className="text-muted-foreground">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <Loader2 className={spinnerClasses} />
      {text && <span className="ml-2 text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}

// Preset loaders for common use cases
export function ButtonLoader({ text = 'Loading...' }: { text?: string }) {
  return <Loader size="sm" text={text} variant="inline" />;
}

export function PageLoader({ text = 'Loading...' }: { text?: string }) {
  return <Loader size="xl" text={text} variant="fullscreen" />;
}

export function CardLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader size="lg" text={text} />
    </div>
  );
}
