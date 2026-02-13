import React from 'react';

interface SimpleStatCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  className?: string;
  testId?: string;
}

export default function SimpleStatCard({
  title,
  value,
  suffix,
  className = 'p-4 bg-muted/50 rounded-lg',
  testId
}: SimpleStatCardProps) {
  return (
    <div className={className} data-testid={testId}>
      <div className="text-sm font-medium text-muted-foreground mb-1">{title}</div>
      <div className="text-2xl font-bold flex items-center gap-2">
        {value}
        {suffix && <span className="text-xs text-muted-foreground font-normal">{suffix}</span>}
      </div>
    </div>
  );
}
