import React from 'react';
import UnifiedCard from './UnifiedCard';

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
  valueColor,
  titleColor,
  className,
  testId
}: StatCardProps) {
  return (
    <UnifiedCard
      title={title}
      value={value}
      valueColor={valueColor}
      titleColor={titleColor}
      className={className}
      testId={testId}
      variant="stat"
    />
  );
}
