import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Edit, Save, X, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { shipmentsApi } from '@/apiClient/shipments';

interface ChangeRiderSectionProps {
  currentRiderId: string | null;
  canChange: boolean;
  onChangeRider: (newRiderId: string, reason?: string) => Promise<void>;
  blockedStatusMessage?: string;
}

export default function ChangeRiderSection({
  currentRiderId,
  canChange,
  onChangeRider,
  blockedStatusMessage
}: ChangeRiderSectionProps) {
  const [isChanging, setIsChanging] = useState(false);
  const [newRiderId, setNewRiderId] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch available riders
  const { data: ridersData, isLoading: isLoadingRiders } = useQuery({
    queryKey: ['available-riders'],
    queryFn: () => shipmentsApi.getAvailableRiders(),
    enabled: isChanging, // Only fetch when changing rider
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const availableRiders = ridersData?.riders || [];

  const handleStartChange = () => {
    setIsChanging(true);
  };

  const handleCancel = () => {
    setIsChanging(false);
    setNewRiderId('');
    setChangeReason('');
  };

  const handleSave = async () => {
    if (!newRiderId.trim()) {
      toast({
        title: "Rider ID required",
        description: "Please enter a rider ID",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onChangeRider(newRiderId.trim(), changeReason);
      setIsChanging(false);
      setNewRiderId('');
      setChangeReason('');
    } catch (error) {
      console.error('Error changing rider:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-purple-600" />
          <h4 className="font-semibold text-lg">Change Rider</h4>
        </div>
        {!isChanging && canChange && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartChange}
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <Edit className="h-4 w-4 mr-1" />
            Change Rider
          </Button>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border">
        <span className="text-sm text-muted-foreground">Current Rider:</span>
        <p className="font-semibold text-base mt-1">{currentRiderId || 'Unassigned'}</p>
      </div>

      {!canChange && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {blockedStatusMessage || 'Cannot change rider at this time.'}
          </AlertDescription>
        </Alert>
      )}

      {isChanging && (
        <div className="space-y-4 pt-3 border-t bg-blue-50/30 dark:bg-blue-950/20 rounded-lg p-4">
          <div>
            <label htmlFor="newRiderId" className="text-sm font-semibold mb-2 block text-foreground">
              New Rider <span className="text-red-500">*</span>
            </label>
            {isLoadingRiders ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading riders...
              </div>
            ) : (
              <Select
                value={newRiderId || undefined}
                onValueChange={setNewRiderId}
                disabled={isSubmitting}
              >
                <SelectTrigger id="newRiderId" className="w-full h-11 bg-background">
                  <SelectValue placeholder="Select a rider" />
                </SelectTrigger>
                <SelectContent>
                  {availableRiders.length > 0 ? (
                    availableRiders.map((rider) => (
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
            {availableRiders.length === 0 && !isLoadingRiders && (
              <p className="text-xs text-muted-foreground mt-2">
                No active riders found. Please ensure riders are approved and active.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="changeReason" className="text-sm font-semibold mb-2 block text-foreground">
              Reason (Optional)
            </label>
            <Textarea
              id="changeReason"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Reason for rider change"
              className="mt-1 bg-background"
              rows={3}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={isSubmitting || !newRiderId.trim()}
              size="sm"
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
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

