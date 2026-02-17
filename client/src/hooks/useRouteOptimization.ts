import { useState, useEffect, useCallback } from 'react';
import { routeAPI } from '@/apiClient/routes';
import { Shipment, RouteLocation, RouteOptimizeResponse } from '@shared/types';
import { useQuery } from '@tanstack/react-query';
import { calculateDistance } from '@/apiClient/routes';

interface UseRouteOptimizationProps {
  session_id: string | null;
  current_location?: { latitude: number; longitude: number };
  enabled?: boolean;
}

interface RouteOptimizationRuntimeConfig {
  autoDeliver: boolean;
  proximityRadiusMeters: number;
}

export function useRouteOptimization({ session_id, current_location, enabled = true }: UseRouteOptimizationProps) {
  const [optimized_path, set_optimized_path] = useState<RouteLocation[]>([]);
  const [is_optimizing, set_is_optimizing] = useState(false);
  const [nearest_point, set_nearest_point] = useState<Shipment[] | null>(null);
  const [skipped_shipment_ids, set_skipped_shipment_ids] = useState<string[]>(() => {
    const saved = localStorage.getItem(`skipped_shipments_${session_id || 'none'}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Fetch shipments assigned to this rider
  const { data: shipment_data, isLoading: is_loading_shipments, refetch: refetch_shipments } = useQuery({
    queryKey: ['rider-shipments', session_id],
    queryFn: () => routeAPI.getShipments(),
    enabled: !!session_id && enabled,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const all_shipments =
    shipment_data?.shipments ||
    (shipment_data as { results?: Shipment[] } | undefined)?.results ||
    [];

  // Filter out skipped shipments
  const shipments = all_shipments.filter(s => !skipped_shipment_ids.includes(s.id));

  const skip_shipment = useCallback((shipment_id: string) => {
    set_skipped_shipment_ids(prev => {
      const next = [...prev, shipment_id];
      localStorage.setItem(`skipped_shipments_${session_id || 'none'}`, JSON.stringify(next));
      return next;
    });
  }, [session_id]);

  const reset_skips = useCallback(() => {
    set_skipped_shipment_ids([]);
    localStorage.removeItem(`skipped_shipments_${session_id || 'none'}`);
  }, [session_id]);

  // Optimize path when shipments or location change significantly
  useEffect(() => {
    if (!current_location || shipments.length === 0 || !enabled) return;

    const optimize = async () => {
      set_is_optimizing(true);
      try {
        // Prepare unique locations for optimization
        const locations_map: Record<string, RouteLocation> = {};
        shipments.forEach(s => {
          if (s.latitude && s.longitude) {
            const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`;
            if (!locations_map[key]) {
              locations_map[key] = {
                latitude: s.latitude,
                longitude: s.longitude,
                address: s.address_display || (typeof s.address === 'string' ? s.address : ''),
                customer_name: s.customer_name
              };
            }
          }
        });

        const locations = Object.values(locations_map);

        const response: RouteOptimizeResponse = await routeAPI.optimizePath({
          current_latitude: current_location.latitude,
          current_longitude: current_location.longitude,
          locations
        });

        if (response.success) {
          set_optimized_path(response.ordered_locations);
        }
      } catch (error) {
        console.error('Failed to optimize path:', error);
      } finally {
        set_is_optimizing(false);
      }
    };

    // Only optimize if we have new shipments or haven't optimized yet
    if (optimized_path.length === 0 || shipments.length !== optimized_path.reduce((acc, loc) => acc + (loc.shipment_id ? 1 : 0), 0)) {
      optimize();
    }
  }, [shipments.length, current_location?.latitude, current_location?.longitude, enabled]);

  // Proximity detection
  useEffect(() => {
    if (!current_location || shipments.length === 0) {
      set_nearest_point(null);
      return;
    }

    const saved_config = localStorage.getItem('riderpro_smart_completion_config');
    const config = saved_config ? JSON.parse(saved_config) : { auto_deliver_radius: 100 };
    const PROXIMITY_THRESHOLD = (config.auto_deliver_radius || 100) / 1000; // Convert meters to km

    // Group shipments by location
    const locations_map: Record<string, Shipment[]> = {};
    shipments.forEach(s => {
      if (s.latitude && s.longitude) {
        const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`;
        if (!locations_map[key]) locations_map[key] = [];
        locations_map[key].push(s);
      }
    });

    let found_nearest: Shipment[] | null = null;
    let min_distance = PROXIMITY_THRESHOLD;

    Object.values(locations_map).forEach(point_shipments => {
      const s = point_shipments[0];
      const dist = calculateDistance(
        current_location.latitude,
        current_location.longitude,
        s.latitude!,
        s.longitude!
      );

      if (dist < min_distance) {
        min_distance = dist;
        found_nearest = point_shipments;
      }
    });

    set_nearest_point(found_nearest);
  }, [current_location, shipments]);

  const bulk_update_status = useCallback(async (target_shipments: Shipment[], event_type: 'pickup' | 'delivery') => {
    if (!session_id || target_shipments.length === 0 || !current_location) return;

    try {
      const response = await routeAPI.bulkRecordShipmentEvent({
        session_id: session_id,
        shipment_ids: target_shipments.map(s => s.id),
        event_type: event_type,
        latitude: current_location.latitude,
        longitude: current_location.longitude
      });

      if (response.success) {
        await refetch_shipments();
      }
      return response;
    } catch (error) {
      console.error('Failed to bulk update status:', error);
      throw error;
    }
  }, [session_id, current_location, refetch_shipments]);

  return {
    shipments,
    optimizedPath: optimized_path,
    isOptimizing: is_optimizing,
    isLoadingShipments: is_loading_shipments,
    nearestPoint: nearest_point,
    bulkUpdateStatus: bulk_update_status,
    skipShipment: skip_shipment,
    resetSkips: reset_skips,
    refetchShipments: refetch_shipments
  };
}
