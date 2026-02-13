import React from 'react';
import UnifiedCard from './UnifiedCard';
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
  icon,
  iconBgColor,
  iconColor,
  valueColor,
  testId,
  suffix,
  className,
  layout = 'icon-right'
}: MetricCardProps) {
  return (
    <UnifiedCard
      title={title}
      value={value}
      suffix={suffix}
      icon={icon}
      iconBgColor={iconBgColor}
      iconColor={iconColor}
      valueColor={valueColor}
      className={className}
      testId={testId}
      variant="default"
      layout={layout}
    />
  );
}
