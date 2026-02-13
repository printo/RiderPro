import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: number | string;
  valueColor?: string;
  titleColor?: string;
  className?: string;
  testId?: string;
}

export default function StatCard({
  title,
  value,
  valueColor = 'text-2xl font-bold',
  titleColor = 'text-xs text-muted-foreground',
  className = 'text-center',
  testId
}: StatCardProps) {
  return (
    <div className={className} data-testid={testId}>
      <div className={valueColor}>
        {value}
      </div>
      <div className={titleColor}>
        {title}
      </div>
    </div>
  );
}
