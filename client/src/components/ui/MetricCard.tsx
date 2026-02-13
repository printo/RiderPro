import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
  valueColor?: string;
  testId?: string;
  suffix?: string;
  className?: string;
  layout?: 'icon-right' | 'icon-left' | 'no-icon';
}

export default function MetricCard({
  title,
  value,
  icon: Icon,
  iconBgColor,
  iconColor,
  valueColor = 'text-foreground',
  testId,
  suffix,
  className = "shadow-sm border-border/60",
  layout = 'icon-right'
}: MetricCardProps) {
  
  const renderContent = () => {
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
          <div className={`${iconBgColor} p-2 rounded-lg`}>
            <Icon className={`${iconColor} h-4 w-4`} />
          </div>
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
        <div className={`${iconBgColor} p-2 sm:p-3 rounded-xl`}>
          <Icon className={`${iconColor} h-6 w-6 sm:h-8 sm:w-8`} />
        </div>
      </div>
    );
  };

  return (
    <Card data-testid={testId} className={className}>
      <CardContent className={layout === 'icon-left' ? 'pt-6' : 'p-4 sm:p-6'}>
        {renderContent()}
      </CardContent>
    </Card>
  );
}
