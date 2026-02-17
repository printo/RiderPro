import { useState, useEffect, useCallback } from 'react';
import { routeAPI } from '@/apiClient/routes';
import { Shipment, RouteLocation, RouteOptimizeResponse } from '@shared/types';
import { useQuery } from '@tanstack/react-query';
import { calculateDistance } from '@/apiClient/routes';

interface UseRouteOptimizationProps {
  sessionId: string | null;
  currentLocation?: { latitude: number; longitude: number };
  enabled?: boolean;
}

interface RouteOptimizationRuntimeConfig {
  autoDeliver: boolean;
  proximityRadiusMeters: number;
}

const ROUTE_OPTIMIZATION_CONFIG_KEY = 'riderpro_route_optimization_config';
const DEFAULT_RUNTIME_CONFIG: RouteOptimizationRuntimeConfig = {
  autoDeliver: false,
  proximityRadiusMeters: 100,
};

export function useRouteOptimization({ sessionId, currentLocation, enabled = true }: UseRouteOptimizationProps) {
  const [optimizedPath, setOptimizedPath] = useState<RouteLocation[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [nearestPoint, setNearestPoint] = useState<Shipment[] | null>(null);
  const [runtimeConfig] = useState<RouteOptimizationRuntimeConfig>(() => {
    try {
      const saved = localStorage.getItem(ROUTE_OPTIMIZATION_CONFIG_KEY);
      return saved ? { ...DEFAULT_RUNTIME_CONFIG, ...JSON.parse(saved) } : DEFAULT_RUNTIME_CONFIG;
    } catch {
      return DEFAULT_RUNTIME_CONFIG;
    }
  });
  const [skippedShipmentIds, setSkippedShipmentIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(`skipped_shipments_${sessionId || 'none'}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Fetch shipments assigned to this rider
  const { data: shipmentData, isLoading: isLoadingShipments, refetch: refetchShipments } = useQuery({
    queryKey: ['rider-shipments', sessionId],
    queryFn: () => routeAPI.getShipments(),
    enabled: !!sessionId && enabled,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const allShipments =
    shipmentData?.shipments ||
    (shipmentData as { results?: Shipment[] } | undefined)?.results ||
    [];

  // Filter out skipped shipments
  const shipments = allShipments.filter(s => !skippedShipmentIds.includes(s.shipment_id));

  const skipShipment = useCallback((shipmentId: string) => {
    setSkippedShipmentIds(prev => {
      const next = [...prev, shipmentId];
      localStorage.setItem(`skipped_shipments_${sessionId || 'none'}`, JSON.stringify(next));
      return next;
    });
  }, [sessionId]);

  const resetSkips = useCallback(() => {
    setSkippedShipmentIds([]);
    localStorage.removeItem(`skipped_shipments_${sessionId || 'none'}`);
  }, [sessionId]);

  // Optimize path when shipments or location change significantly
  useEffect(() => {
    if (!currentLocation || shipments.length === 0 || !enabled) return;

    const optimize = async () => {
      setIsOptimizing(true);
      try {
        // Prepare unique locations for optimization
        const locationsMap: Record<string, RouteLocation> = {};
        shipments.forEach(s => {
          if (s.latitude && s.longitude) {
            const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`;
            if (!locationsMap[key]) {
              locationsMap[key] = {
                latitude: s.latitude,
                longitude: s.longitude,
                address: s.addressDisplay || s.deliveryAddress,
                customerName: s.customerName
              };
            }
          }
        });

        const locations = Object.values(locationsMap);

        const response: RouteOptimizeResponse = await routeAPI.optimizePath({
          current_latitude: currentLocation.latitude,
          current_longitude: currentLocation.longitude,
          locations
        });

        if (response.success) {
          setOptimizedPath(response.ordered_locations);
        }
      } catch (error) {
        console.error('Failed to optimize path:', error);
      } finally {
        setIsOptimizing(false);
      }
    };

    // Only optimize if we have new shipments or haven't optimized yet
    if (optimizedPath.length === 0 || shipments.length !== optimizedPath.reduce((acc, loc) => acc + (loc.shipment_id ? 1 : 0), 0)) {
      optimize();
    }
  }, [shipments.length, currentLocation?.latitude, currentLocation?.longitude, enabled]);

  // Proximity detection
  useEffect(() => {
    if (!currentLocation || shipments.length === 0) {
      setNearestPoint(null);
      return;
    }

    const proximityRadiusMeters = runtimeConfig.proximityRadiusMeters || DEFAULT_RUNTIME_CONFIG.proximityRadiusMeters;
    const PROXIMITY_THRESHOLD = proximityRadiusMeters / 1000; // Convert meters to km

    // Group shipments by location
    const locationsMap: Record<string, Shipment[]> = {};
    shipments.forEach(s => {
      if (s.latitude && s.longitude) {
        const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`;
        if (!locationsMap[key]) locationsMap[key] = [];
        locationsMap[key].push(s);
      }
    });

    let foundNearest: Shipment[] | null = null;
    let minDistance = PROXIMITY_THRESHOLD;

    Object.values(locationsMap).forEach(pointShipments => {
      const s = pointShipments[0];
      const dist = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        s.latitude!,
        s.longitude!
      );

      if (dist < minDistance) {
        minDistance = dist;
        foundNearest = pointShipments;
      }
    });

    setNearestPoint(foundNearest);
  }, [currentLocation, shipments, runtimeConfig.proximityRadiusMeters]);

  const bulkUpdateStatus = useCallback(async (targetShipments: Shipment[], eventType: 'pickup' | 'delivery') => {
    if (!sessionId || targetShipments.length === 0 || !currentLocation) return;

    try {
      const response = await routeAPI.bulkRecordShipmentEvent({
        session_id: sessionId,
        shipment_ids: targetShipments.map(s => s.shipment_id),
        event_type: eventType,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      });

      if (response.success) {
        await refetchShipments();
      }
      return response;
    } catch (error) {
      console.error('Failed to bulk update status:', error);
      throw error;
    }
  }, [sessionId, currentLocation, refetchShipments]);

  return {
    shipments,
    optimizedPath,
    isOptimizing,
    isLoadingShipments,
    nearestPoint,
    runtimeConfig,
    bulkUpdateStatus,
    skipShipment,
    resetSkips,
    refetchShipments
  };
}
