import { useCallback, useEffect, useRef } from 'react';
import { useRouteTracking } from './useRouteAPI';
import { useGPSTracking } from './useGPSTracking';
import { useToast } from './use-toast';
import { Shipment } from '@shared/types';

export interface ShipmentTrackingOptions {
  employee_id: string;
  auto_record_events?: boolean;
  show_notifications?: boolean;
  on_location_recorded?: (shipment_id: string, event_type: 'pickup' | 'delivery', coordinates: { latitude: number; longitude: number }) => void;
  on_location_error?: (shipment_id: string, error: Error) => void;
}

export function useShipmentTracking(options: ShipmentTrackingOptions) {
  const {
    employee_id,
    auto_record_events = true,
    show_notifications = true,
    on_location_recorded,
    on_location_error
  } = options;

  const { toast } = useToast();
  const recording_ref = useRef<Set<string>>(new Set());

  const {
    hasActiveSession,
    activeSession,
    recordShipmentEvent,
    isSubmitting
  } = useRouteTracking(employee_id);

  const {
    getCurrentPosition,
    isLoading: isGettingLocation
  } = useGPSTracking();

  /**
   * Record GPS coordinates for a shipment event
   */
  const record_shipment_location = useCallback(async (
    shipment: Shipment,
    event_type: 'pickup' | 'delivery'
  ): Promise<{ latitude: number; longitude: number } | null> => {
    if (!hasActiveSession) {
      if (show_notifications) {
        toast({
          title: "No Active Route",
          description: "GPS location cannot be recorded without an active route session.",
          variant: "destructive",
        });
      }
      return null;
    }

    // Prevent duplicate recordings for the same shipment
    const recording_key = `${shipment.id}-${event_type}`;
    if (recording_ref.current.has(recording_key)) {
      return null;
    }

    recording_ref.current.add(recording_key);

    try {
      // Get current GPS position
      const position = await getCurrentPosition();

      // Record the shipment event with GPS coordinates
      await recordShipmentEvent(
        shipment.id,
        event_type,
        position.latitude,
        position.longitude
      );

      const coordinates = {
        latitude: position.latitude,
        longitude: position.longitude
      };

      if (show_notifications) {
        toast({
          title: "Location Recorded",
          description: `GPS coordinates recorded for ${event_type} of shipment #${String(shipment.id).slice(-8)}.`,
        });
      }

      // Call success callback
      on_location_recorded?.(shipment.id, event_type, coordinates);

      return coordinates;

    } catch (error) {
      console.error('Failed to record shipment location:', error);

      const error_obj = error as Error;

      if (show_notifications) {
        toast({
          title: "GPS Recording Failed",
          description: `Failed to record GPS location for ${event_type}: ${error_obj.message}`,
          variant: "destructive",
        });
      }

      // Call error callback
      on_location_error?.(shipment.id, error_obj);

      return null;
    } finally {
      // Remove from recording set after a delay to prevent immediate re-recording
      setTimeout(() => {
        recording_ref.current.delete(recording_key);
      }, 5000);
    }
  }, [
    hasActiveSession,
    getCurrentPosition,
    recordShipmentEvent,
    show_notifications,
    toast,
    on_location_recorded,
    on_location_error
  ]);

  /**
   * Automatically record location when shipment status changes
   */
  const handle_status_change = useCallback(async (
    shipment: Shipment,
    new_status: string,
    old_status?: string
  ) => {
    if (!auto_record_events || !hasActiveSession) {
      return null;
    }

    // Determine if this status change should trigger GPS recording
    let event_type: 'pickup' | 'delivery' | null = null;

    if (new_status === 'Picked Up' && old_status !== 'Picked Up') {
      event_type = 'pickup';
    } else if (new_status === 'Delivered' && old_status !== 'Delivered') {
      event_type = 'delivery';
    } else if (new_status === 'In Transit' && shipment.type === 'pickup' && old_status === 'Assigned') {
      // For pickup shipments, record pickup location when status changes to In Transit
      event_type = 'pickup';
    } else if (new_status === 'In Transit' && shipment.type === 'delivery' && old_status === 'Assigned') {
      // For delivery shipments, we might want to record when they start transit
      return null;
    }

    if (event_type) {
      return await record_shipment_location(shipment, event_type);
    }

    return null;
  }, [auto_record_events, hasActiveSession, record_shipment_location]);

  /**
   * Check if GPS recording is available
   */
  const can_record_location = useCallback(() => {
    return hasActiveSession && !isGettingLocation && !isSubmitting;
  }, [hasActiveSession, isGettingLocation, isSubmitting]);

  /**
   * Get recording status for a specific shipment
   */
  const is_recording_for_shipment = useCallback((shipment_id: string, event_type?: 'pickup' | 'delivery') => {
    if (event_type) {
      return recording_ref.current.has(`${shipment_id}-${event_type}`);
    }

    // Check if recording any event for this shipment
    return Array.from(recording_ref.current).some(key => key.startsWith(`${shipment_id}-`));
  }, []);

  /**
   * Manually record location for a shipment
   */
  const record_location_for_shipment = useCallback(async (
    shipment: Shipment,
    event_type: 'pickup' | 'delivery'
  ) => {
    return await record_shipment_location(shipment, event_type);
  }, [record_shipment_location]);

  // Clean up recording set on unmount
  useEffect(() => {
    return () => {
      recording_ref.current.clear();
    };
  }, []);

  return {
    // Status
    hasActiveSession,
    activeSession,
    canRecordLocation: can_record_location(),
    isGettingLocation,
    isSubmitting,

    // Actions
    recordLocationForShipment: record_location_for_shipment,
    handleStatusChange: handle_status_change,

    // Utilities
    isRecordingForShipment: is_recording_for_shipment,

    // Raw functions for advanced usage
    recordShipmentLocation: record_shipment_location,
  };
}

/**
 * Hook for tracking multiple shipments
 */
export function useMultipleShipmentTracking(
  shipments: Shipment[],
  employee_id: string,
  options: Omit<ShipmentTrackingOptions, 'employee_id'> = {}
) {
  const tracking = useShipmentTracking({ ...options, employee_id });

  /**
   * Handle status change for any shipment in the list
   */
  const handle_shipment_status_change = useCallback(async (
    shipment_id: string,
    new_status: string,
    old_status?: string
  ) => {
    const shipment = shipments.find(s => s.id === shipment_id);
    if (!shipment) {
      console.warn(`Shipment ${shipment_id} not found in tracking list`);
      return null;
    }

    return await tracking.handleStatusChange(shipment, new_status, old_status);
  }, [shipments, tracking]);

  /**
   * Record location for any shipment in the list
   */
  const record_location_for_shipment_id = useCallback(async (
    shipment_id: string,
    event_type: 'pickup' | 'delivery'
  ) => {
    const shipment = shipments.find(s => s.id === shipment_id);
    if (!shipment) {
      throw new Error(`Shipment ${shipment_id} not found in tracking list`);
    }

    return await tracking.recordLocationForShipment(shipment, event_type);
  }, [shipments, tracking]);

  /**
   * Get shipments that can have their location recorded
   */
  const get_trackable_shipments = useCallback(() => {
    if (!tracking.hasActiveSession) {
      return [];
    }

    return shipments.filter(shipment => {
      const can_pickup = shipment.type === 'pickup' && shipment.status === 'Assigned';
      const can_deliver = shipment.type === 'delivery' && shipment.status === 'Assigned';
      return can_pickup || can_deliver;
    });
  }, [shipments, tracking.hasActiveSession]);

  return {
    ...tracking,
    handleShipmentStatusChange: handle_shipment_status_change,
    recordLocationForShipmentId: record_location_for_shipment_id,
    getTrackableShipments: get_trackable_shipments,
    trackableShipments: get_trackable_shipments(),
  };
}