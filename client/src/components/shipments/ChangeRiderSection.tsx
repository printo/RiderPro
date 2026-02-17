import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Edit, Save, X, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { shipmentsApi } from '@/apiClient/shipments';

interface ChangeRiderSectionProps {
  current_rider_id: string | null;
  can_change: boolean;
  on_change_rider: (new_rider_id: string, reason?: string) => Promise<void>;
  blocked_status_message?: string;
}

export default function ChangeRiderSection({
  current_rider_id,
  can_change,
  on_change_rider,
  blocked_status_message
}: ChangeRiderSectionProps) {
  const [is_changing, set_is_changing] = useState(false);
  const [new_rider_id, set_new_rider_id] = useState('');
  const [change_reason, set_change_reason] = useState('');
  const [is_submitting, set_is_submitting] = useState(false);
  const { toast } = useToast();

  // Fetch available riders
  const { data: riders_data, isLoading: is_loading_riders } = useQuery({
    queryKey: ['available-riders'],
    queryFn: () => shipmentsApi.getAvailableRiders(),
    enabled: is_changing, // Only fetch when changing rider
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const available_riders = riders_data?.riders || [];

  const handle_start_change = () => {
    set_is_changing(true);
  };

  const handle_cancel = () => {
    set_is_changing(false);
    set_new_rider_id('');
    set_change_reason('');
  };

  const handle_save = async () => {
    if (!new_rider_id.trim()) {
      toast({
        title: "Rider ID required",
        description: "Please enter a rider ID",
        variant: "destructive",
      });
      return;
    }

    set_is_submitting(true);
    try {
      await on_change_rider(new_rider_id.trim(), change_reason);
      set_is_changing(false);
      set_new_rider_id('');
      set_change_reason('');
    } catch (error) {
      console.error('Error changing rider:', error);
    } finally {
      set_is_submitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-purple-600" />
          <h4 className="font-semibold text-lg">Change Rider</h4>
        </div>
        {!is_changing && can_change && (
          <Button
            variant="outline"
            size="sm"
            onClick={handle_start_change}
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <Edit className="h-4 w-4 mr-1" />
            Change Rider
          </Button>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border">
        <span className="text-sm text-muted-foreground">Current Rider:</span>
        <p className="font-semibold text-base mt-1">{current_rider_id || 'Unassigned'}</p>
      </div>

      {!can_change && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {blocked_status_message || 'Cannot change rider at this time.'}
          </AlertDescription>
        </Alert>
      )}

      {is_changing && (
        <div className="space-y-4 pt-3 border-t bg-blue-50/30 dark:bg-blue-950/20 rounded-lg p-4">
          <div>
            <label htmlFor="new_rider_id" className="text-sm font-semibold mb-2 block text-foreground">
              New Rider <span className="text-red-500">*</span>
            </label>
            {is_loading_riders ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading riders...
              </div>
            ) : (
              <Select
                value={new_rider_id || undefined}
                onValueChange={set_new_rider_id}
                disabled={is_submitting}
              >
                <SelectTrigger id="new_rider_id" className="w-full h-11 bg-background">
                  <SelectValue placeholder="Select a rider" />
                </SelectTrigger>
                <SelectContent>
                  {available_riders.length > 0 ? (
                    available_riders.map((rider) => (
                      <SelectItem key={rider.id} value={rider.id}>
                        <div className="flex flex-col py-1">
                          <span className="font-medium">{rider.name || rider.id}</span>
                          {rider.email && (
                            <span className="text-xs text-muted-foreground">{rider.email}</span>
                          )}
                          <span className="text-xs text-blue-600 font-mono">{rider.id}</span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No riders available</div>
                  )}
                </SelectContent>
              </Select>
            )}
            {available_riders.length === 0 && !is_loading_riders && (
              <p className="text-xs text-muted-foreground mt-2">
                No active riders found. Please ensure riders are approved and active.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="change_reason" className="text-sm font-semibold mb-2 block text-foreground">
              Reason (Optional)
            </label>
            <Textarea
              id="change_reason"
              value={change_reason}
              onChange={(e) => set_change_reason(e.target.value)}
              placeholder="Reason for rider change"
              className="mt-1 bg-background"
              rows={3}
              disabled={is_submitting}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handle_save}
              disabled={is_submitting || !new_rider_id.trim()}
              size="sm"
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {is_submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={handle_cancel}
              disabled={is_submitting}
              size="sm"
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
