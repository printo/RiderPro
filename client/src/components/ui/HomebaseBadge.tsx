import { Badge } from '@/components/ui/badge';
import { Homebase } from '@shared/types';
import { MapPin } from 'lucide-react';

interface HomebaseBadgeProps {
  homebase?: Homebase | null;
  className?: string;
  showIcon?: boolean;
}

export function HomebaseBadge({ homebase, className = '', showIcon = true }: HomebaseBadgeProps) {
  if (!homebase) {
    return (
      <Badge variant="outline" className={`bg-gray-100 text-gray-400 border-gray-200 ${className}`}>
        {showIcon && <MapPin className="w-3 h-3 mr-1" />}
        No Homebase
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`bg-indigo-50 text-indigo-700 border-indigo-200 font-medium ${className}`}
      title={`${homebase.homebase_id}: ${homebase.name}`}
    >
      {showIcon && <MapPin className="w-3 h-3 mr-1" />}
      {homebase.name}
    </Badge>
  );
}

export function HomebaseIdBadge({ homebaseId, className = '' }: { homebaseId: string; className?: string }) {
  return (
    <Badge variant="secondary" className={`bg-slate-100 text-slate-700 border-slate-200 font-mono text-[10px] ${className}`}>
      {homebaseId}
    </Badge>
  );
}
