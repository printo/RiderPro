import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleControlAPI } from '@/apiClient/vehicleControl';

/**
 * Manager panel: pending rider vehicle-change requests with approve/reject.
 * Approving updates the rider's vehicle type (which sets mileage & fuel cost).
 * Self-contained — drop it into any admin/manager page. Hidden when nothing
 * is pending. The endpoints are manager-gated server-side.
 */
export default function VehicleChangeRequests() {
  const queryClient = useQueryClient();
  const [actingId, setActingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-change-requests', 'pending'],
    queryFn: () => vehicleControlAPI.getPendingVehicleRequests(),
    refetchInterval: 30000,
  });

  const requests = data?.requests ?? [];

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'reject' }) => {
      setActingId(id);
      return action === 'approve'
        ? vehicleControlAPI.approveVehicleChange(id)
        : vehicleControlAPI.rejectVehicleChange(id);
    },
    onSettled: () => {
      setActingId(null);
      queryClient.invalidateQueries({ queryKey: ['vehicle-change-requests', 'pending'] });
    },
  });

  // Keep the page clean when there's nothing to action.
  if (!isLoading && requests.length === 0) return null;

  return (
    <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
        🛵 Vehicle change requests
        <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
          {requests.length} pending
        </span>
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Approving updates the rider's vehicle, which sets their mileage &amp; fuel cost.
      </p>
      <ul className="mt-3 space-y-2">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
          >
            <div className="text-sm">
              <span className="font-medium text-gray-900">{r.rider_name || r.rider_id}</span>
              <span className="text-gray-500"> · {r.current_vehicle_name || 'No vehicle'} → </span>
              <span className="font-medium text-gray-900">{r.requested_vehicle_name}</span>
              {r.requested_fuel_efficiency != null && (
                <span className="text-gray-500"> ({r.requested_fuel_efficiency} km/l)</span>
              )}
              {r.reason ? <span className="block text-xs text-gray-500 mt-0.5">“{r.reason}”</span> : null}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => decide.mutate({ id: r.id, action: 'approve' })}
                disabled={actingId === r.id}
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {actingId === r.id ? '…' : 'Approve'}
              </button>
              <button
                onClick={() => decide.mutate({ id: r.id, action: 'reject' })}
                disabled={actingId === r.id}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
