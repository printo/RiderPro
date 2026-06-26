import { Badge } from '@/components/ui/badge';
import { Bike, Car, Truck, Package, type LucideIcon } from 'lucide-react';

export type DispatchOption = 'printo-bike' | 'milkround' | 'goods-auto' | '3PL' | '';

interface DispatchBadgeProps {
  dispatchOption?: string;
  className?: string;
  /** Render just the mode icon (with the label as a tooltip) for compact, at-a-glance use in cards/tables. */
  iconOnly?: boolean;
}

const DISPATCH_CONFIG: Record<string, { label: string; Icon: LucideIcon; color: string }> = {
  'printo-bike': {
    label: 'Printo Bike',
    Icon: Bike,
    color: 'bg-blue-100 text-blue-800 border-blue-300'
  },
  'milkround': {
    label: 'Milkround Auto',
    Icon: Car,
    color: 'bg-green-100 text-green-800 border-green-300'
  },
  'goods-auto': {
    label: 'Goods Auto',
    Icon: Truck,
    color: 'bg-orange-100 text-orange-800 border-orange-300'
  },
  '3PL': {
    label: '3PL',
    Icon: Package,
    color: 'bg-purple-100 text-purple-800 border-purple-300'
  }
};

export function DispatchBadge({ dispatchOption, className = '', iconOnly = false }: DispatchBadgeProps) {
  if (!dispatchOption || !DISPATCH_CONFIG[dispatchOption]) {
    return null;
  }

  const { label, Icon, color } = DISPATCH_CONFIG[dispatchOption];

  // Compact icon-only chip — quick visual reference for the dispatch mode.
  if (iconOnly) {
    return (
      <span
        title={label}
        aria-label={label}
        className={`inline-flex items-center justify-center rounded-md border ${color} ${className}`}
      >
        <Icon className="h-4 w-4" />
      </span>
    );
  }

  return (
    <Badge variant="outline" className={`gap-1 ${color} ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

export function getDispatchLabel(dispatchOption?: string): string {
  if (!dispatchOption || !DISPATCH_CONFIG[dispatchOption]) {
    return 'Not Set';
  }
  return DISPATCH_CONFIG[dispatchOption].label;
}
