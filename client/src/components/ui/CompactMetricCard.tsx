import React from 'react';
import UnifiedCard from './UnifiedCard';
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
  icon,
  iconColor,
  testId
}: CompactMetricCardProps) {
  return (
    <UnifiedCard
      title={title}
      value={value}
      suffix={suffix}
      icon={icon}
      iconColor={iconColor}
      testId={testId}
      variant="compact"
    />
  );
}
