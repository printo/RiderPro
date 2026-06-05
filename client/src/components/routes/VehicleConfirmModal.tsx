import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Bike, AlertTriangle } from 'lucide-react';
import { useMyVehicle } from '@/hooks/useMyVehicle';
import { vehicleControlAPI } from '@/apiClient/vehicleControl';

interface VehicleConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the rider chooses to start the session (confirm, or start-anyway). */
  onProceed: () => void;
}

/**
 * Day-start vehicle confirmation. The vehicle sets the rider's mileage (and so
 * the fuel/reimbursement money), so we confirm it before each session:
 *  - has a vehicle  → "Today's vehicle: X · Y km/l" → Confirm & Start
 *  - no vehicle     → warn + "Start anyway" (fuel uses a default, flagged) + "Set my vehicle"
 *  - pending request→ show it's awaiting approval; start with the current vehicle
 * Requesting/changing a vehicle goes to a manager for approval.
 */
export default function VehicleConfirmModal({ open, onOpenChange, onProceed }: VehicleConfirmModalProps) {
  const { data, isLoading, refetch } = useMyVehicle(open);
  const [picking, setPicking] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = data?.current_vehicle ?? null;
  const pending = data?.pending_request ?? null;
  const available = data?.available_vehicles ?? [];

  const submitRequest = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await vehicleControlAPI.requestVehicleChange(selectedId);
      if (!res.success) throw new Error(res.message || 'Request failed');
      setPicking(false);
      setSelectedId('');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const start = () => {
    onOpenChange(false);
    onProceed();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bike className="w-5 h-5 text-primary" /> Confirm your vehicle
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" /></div>
        ) : picking ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Pick your vehicle. A manager approves it before it's used for mileage.</p>
            <div className="space-y-1.5 max-h-56 overflow-auto">
              {available.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm flex justify-between items-center ${selectedId === v.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <span>{v.name}</span>
                  <span className="text-xs text-muted-foreground">{v.fuel_efficiency} km/l{selectedId === v.id ? '  ✓' : ''}</span>
                </button>
              ))}
              {available.length === 0 && <p className="text-xs text-muted-foreground">No vehicle types configured. Ask an admin to add one.</p>}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {pending ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                A change to <strong>{pending.requested_vehicle_name}</strong> is <strong>pending approval</strong>. You'll keep using {current ? <strong>{current.name}</strong> : 'the default'} until it's approved.
              </div>
            ) : current ? (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                Today's vehicle: <strong>{current.name}</strong> · {current.fuel_efficiency} km/l
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>No vehicle assigned — fuel &amp; mileage will use a default until you set one. You can start now and set it anytime.</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {picking ? (
            <>
              <Button className="w-full" disabled={!selectedId || submitting} onClick={submitRequest}>
                {submitting ? 'Submitting…' : 'Submit for approval'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { setPicking(false); setError(null); }}>Back</Button>
            </>
          ) : (
            <>
              <Button className="w-full" onClick={start}>
                {current ? 'Confirm & Start' : 'Start anyway'}
              </Button>
              {!pending && (
                <Button variant="outline" className="w-full" onClick={() => setPicking(true)}>
                  {current ? 'Request a different vehicle' : 'Set my vehicle'}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
