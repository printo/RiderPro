import { cn } from "@/lib/utils";
import { ShipmentStatus } from "@shared/types";
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  XCircle,
  ArrowRightLeft,
  PackageCheck,
  PackageX,
  MapPin
} from "lucide-react";

interface ShipmentStatusBadgeProps {
  status: ShipmentStatus;
  type?: 'delivery' | 'pickup';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  show_icon?: boolean;
}

export function ShipmentStatusBadge({
  status,
  type = 'delivery',
  className = '',
  size = 'md',
  show_icon = true
}: ShipmentStatusBadgeProps) {
  const status_config = {
    'Initiated': {
      icon: Clock,
      color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      label: 'Initiated'
    },
    'Assigned': {
      icon: type === 'delivery' ? Truck : Package,
      color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      label: 'Assigned'
    },
    'Collected': {
      icon: PackageCheck,
      color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      label: 'Collected'
    },
    'In Transit': {
      icon: ArrowRightLeft,
      color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      label: 'In Transit'
    },
    'Delivered': {
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      label: 'Delivered'
    },
    'Picked Up': {
      icon: PackageCheck,
      color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      label: 'Picked Up'
    },
    'Skipped': {
      icon: MapPin,
      color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      label: 'Skipped'
    },
    'Returned': {
      icon: PackageX,
      color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      label: 'Returned'
    },
    'Cancelled': {
      icon: XCircle,
      color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
      label: 'Cancelled'
    }
  };

  const config = status_config[status] || {
    icon: Clock,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    label: status
  };

  const Icon = config.icon;
  const size_classes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        size_classes[size],
        config.color,
        className
      )}
    >
      {show_icon && <Icon className={`${size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} mr-1.5`} />}
      <span>{config.label}</span>
    </div>
  );
}
