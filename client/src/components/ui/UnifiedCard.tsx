import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface UnifiedCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  icon?: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  valueColor?: string;
  titleColor?: string;
  className?: string;
  testId?: string;
  variant?: 'default' | 'simple' | 'compact' | 'stat';
  layout?: 'icon-right' | 'icon-left' | 'no-icon';
}

export default function UnifiedCard({
  title,
  value,
  suffix,
  icon: Icon,
  iconBgColor,
  iconColor,
  valueColor = 'text-2xl font-bold',
  titleColor = 'text-xs text-muted-foreground',
  className = '',
  testId,
  variant = 'default',
  layout = 'icon-right'
}: UnifiedCardProps) {
  
  const renderContent = () => {
    // Simple variant - minimal styling
    if (variant === 'simple') {
      return (
        <div className={className || 'p-4 bg-muted/50 rounded-lg'} data-testid={testId}>
          <div className="text-sm font-medium text-muted-foreground mb-1">{title}</div>
          <div className="text-2xl font-bold flex items-center gap-2">
            {value}
            {suffix && <span className="text-xs text-muted-foreground font-normal">{suffix}</span>}
          </div>
        </div>
      );
    }

    // Stat variant - centered text, no card wrapper
    if (variant === 'stat') {
      return (
        <div className={className || 'text-center'} data-testid={testId}>
          <div className={valueColor}>
            {value}
            {suffix && <span className="text-sm font-normal ml-1">{suffix}</span>}
          </div>
          <div className={titleColor}>
            {title}
          </div>
        </div>
      );
    }

    // Compact variant - smaller card with icon
    if (variant === 'compact') {
      return (
        <Card data-testid={testId} className={className}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {Icon && <Icon className={`h-4 w-4 ${iconColor}`} />}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{value}</span>
              {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Default variant - full featured card
    if (layout === 'no-icon') {
      return (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p
            className={`text-2xl sm:text-4xl font-extrabold ${valueColor}`}
            data-testid={testId?.replace('card-', 'text-')}
          >
            {value}{suffix}
          </p>
        </div>
      );
    }

    if (layout === 'icon-left') {
      return (
        <div className="flex items-center gap-2">
          {Icon && (
            <div className={`${iconBgColor} p-2 rounded-lg`}>
              <Icon className={`${iconColor} h-4 w-4`} />
            </div>
          )}
          <div>
            <p className="text-2xl font-bold">
              {value}{suffix}
            </p>
            <p className="text-sm text-gray-600">{title}</p>
          </div>
        </div>
      );
    }

    // Default: icon-right layout
    return (
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p
            className={`text-2xl sm:text-4xl font-extrabold ${valueColor}`}
            data-testid={testId?.replace('card-', 'text-')}
          >
            {value}{suffix}
          </p>
        </div>
        {Icon && (
          <div className={`${iconBgColor} p-2 sm:p-3 rounded-xl`}>
            <Icon className={`${iconColor} h-6 w-6 sm:h-8 sm:w-8`} />
          </div>
        )}
      </div>
    );
  };

  // Don't wrap in Card for simple and stat variants
  if (variant === 'simple' || variant === 'stat') {
    return renderContent();
  }

  return (
    <Card data-testid={testId} className={className || "shadow-sm border-border/60"}>
      <CardContent className={layout === 'icon-left' ? 'pt-6' : 'p-4 sm:p-6'}>
        {renderContent()}
      </CardContent>
    </Card>
  );
}
