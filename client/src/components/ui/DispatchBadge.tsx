import { Badge } from '@/components/ui/badge';

export type DispatchOption = 'printo-bike' | 'milkround' | 'goods-auto' | '3PL' | '';

interface DispatchBadgeProps {
  dispatchOption?: string;
  className?: string;
}

const DISPATCH_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  'printo-bike': {
    label: 'Printo Bike',
    variant: 'default',
    color: 'bg-blue-100 text-blue-800 border-blue-300'
  },
  'milkround': {
    label: 'Milkround Auto',
    variant: 'secondary',
    color: 'bg-green-100 text-green-800 border-green-300'
  },
  'goods-auto': {
    label: 'Goods Auto',
    variant: 'outline',
    color: 'bg-orange-100 text-orange-800 border-orange-300'
  },
  '3PL': {
    label: '3PL',
    variant: 'destructive',
    color: 'bg-purple-100 text-purple-800 border-purple-300'
  }
};

export function DispatchBadge({ dispatchOption, className = '' }: DispatchBadgeProps) {
  if (!dispatchOption || !DISPATCH_CONFIG[dispatchOption]) {
    return null;
  }

  const config = DISPATCH_CONFIG[dispatchOption];

  return (
    <Badge
      variant={config.variant}
      className={`${config.color} ${className}`}
    >
      {config.label}
    </Badge>
  );
}

export function getDispatchLabel(dispatchOption?: string): string {
  if (!dispatchOption || !DISPATCH_CONFIG[dispatchOption]) {
    return 'Not Set';
  }
  return DISPATCH_CONFIG[dispatchOption].label;
}
