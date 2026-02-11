import React, { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Homebase } from '@shared/types';
import AuthService from '@/services/AuthService';
import { MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HomebaseSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function HomebaseSelector({
  value,
  onValueChange,
  placeholder = "Select Homebase",
  className = "",
  disabled = false
}: HomebaseSelectorProps) {
  const [homebases, setHomebases] = useState<Homebase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHomebases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await AuthService.getInstance().fetchHomebases();
      if (result.success && result.homebases) {
        setHomebases(result.homebases);
      } else {
        setError(result.message || "Failed to load homebases");
      }
    } catch (err) {
      setError("Network error loading homebases");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHomebases();
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <Select
          value={value}
          onValueChange={onValueChange}
          disabled={disabled || isLoading}
        >
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
            </div>
          </SelectTrigger>
          <SelectContent>
            {homebases.map((hb) => (
              <SelectItem key={hb.homebase_id} value={hb.homebase_id}>
                <div className="flex flex-col">
                  <span className="font-medium">{hb.name}</span>
                  <span className="text-xs text-slate-500 font-mono">{hb.homebase_id}</span>
                </div>
              </SelectItem>
            ))}
            {homebases.length === 0 && !isLoading && (
              <div className="p-2 text-sm text-center text-slate-500">
                No homebases found. Sync from POPS needed.
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(e) => { e.preventDefault(); loadHomebases(); }}
        disabled={isLoading}
        title="Refresh homebases"
        className="h-10 w-10"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
