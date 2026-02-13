import React from 'react';
import UnifiedCard from './UnifiedCard';

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
  className,
  testId
}: SimpleStatCardProps) {
  return (
    <UnifiedCard
      title={title}
      value={value}
      suffix={suffix}
      className={className}
      testId={testId}
      variant="simple"
    />
  );
}
