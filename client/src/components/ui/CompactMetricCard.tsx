import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface CompactMetricCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  icon: LucideIcon;
  iconColor: string;
  testId?: string;
}

export default function CompactMetricCard({
  title,
  value,
  suffix,
  icon: Icon,
  iconColor,
  testId
}: CompactMetricCardProps) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
