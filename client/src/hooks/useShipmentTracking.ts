import { useCallback, useEffect, useRef } from 'react';
import { useRouteTracking } from './useRouteAPI';
import { useGPSTracking } from './useGPSTracking';
import { useToast } from './use-toast';
import { Shipment } from '@shared/types';

export interface ShipmentTrackingOptions {
  employeeId: string;
  autoRecordEvents?: boolean;
  showNotifications?: boolean;
  onLocationRecorded?: (shipmentId: string, eventType: 'pickup' | 'delivery', coordinates: { latitude: number; longitude: number }) => void;
  onLocationError?: (shipmentId: string, error: Error) => void;
}

export function useShipmentTracking(options: ShipmentTrackingOptions) {
  const {
    employeeId,
    autoRecordEvents = true,
    showNotifications = true,
    onLocationRecorded,
    onLocationError
  } = options;

  const { toast } = useToast();
  const recordingRef = useRef<Set<string>>(new Set());

  const {
    hasActiveSession,
    activeSession,
    recordShipmentEvent,
    isSubmitting
  } = useRouteTracking(employeeId);

  const {
    getCurrentPosition,
    isLoading: isGettingLocation
  } = useGPSTracking();

  /**
   * Record GPS coordinates for a shipment event
   */
  const recordShipmentLocation = useCallback(async (
    shipment: Shipment,
    eventType: 'pickup' | 'delivery'
  ): Promise<{ latitude: number; longitude: number } | null> => {
    if (!hasActiveSession) {
      if (showNotifications) {
        toast({
          title: "No Active Route",
          description: "GPS location cannot be recorded without an active route session.",
          variant: "destructive",
        });
      }
      return null;
    }

    // Prevent duplicate recordings for the same shipment
    const recordingKey = `${shipment.shipment_id}-${eventType}`;
    if (recordingRef.current.has(recordingKey)) {
      return null;
    }

    recordingRef.current.add(recordingKey);

    try {
      // Get current GPS position
      const position = await getCurrentPosition();

      // Record the shipment event with GPS coordinates
      await recordShipmentEvent(
        shipment.shipment_id,
        eventType,
        position.latitude,
        position.longitude
      );

      const coordinates = {
        latitude: position.latitude,
        longitude: position.longitude
      };

      if (showNotifications) {
        toast({
          title: "Location Recorded",
          description: `GPS coordinates recorded for ${eventType} of shipment #${shipment.shipment_id.slice(-8)}.`,
        });
      }

      // Call success callback
      onLocationRecorded?.(shipment.shipment_id, eventType, coordinates);

      return coordinates;

    } catch (error) {
      console.error('Failed to record shipment location:', error);

      const errorObj = error as Error;

      if (showNotifications) {
        toast({
          title: "GPS Recording Failed",
          description: `Failed to record GPS location for ${eventType}: ${errorObj.message}`,
          variant: "destructive",
        });
      }

      // Call error callback
      onLocationError?.(shipment.shipment_id, errorObj);

      return null;
    } finally {
      // Remove from recording set after a delay to prevent immediate re-recording
      setTimeout(() => {
        recordingRef.current.delete(recordingKey);
      }, 5000);
    }
  }, [
    hasActiveSession,
    getCurrentPosition,
    recordShipmentEvent,
    showNotifications,
    toast,
    onLocationRecorded,
    onLocationError
  ]);

  /**
   * Automatically record location when shipment status changes
   */
  const handleStatusChange = useCallback(async (
    shipment: Shipment,
    newStatus: string,
    oldStatus?: string
  ) => {
    if (!autoRecordEvents || !hasActiveSession) {
      return null;
    }

    // Determine if this status change should trigger GPS recording
    let eventType: 'pickup' | 'delivery' | null = null;

    if (newStatus === 'Picked Up' && oldStatus !== 'Picked Up') {
      eventType = 'pickup';
    } else if (newStatus === 'Collected' && oldStatus !== 'Collected') {
      eventType = 'pickup';
    } else if (newStatus === 'Delivered' && oldStatus !== 'Delivered') {
      eventType = 'delivery';
    } else if (newStatus === 'In Transit' && shipment.type === 'pickup' && oldStatus === 'Assigned') {
      // For pickup shipments, record pickup location when status changes to In Transit
      eventType = 'pickup';
    } else if (newStatus === 'In Transit' && shipment.type === 'delivery' && oldStatus === 'Assigned') {
      // For delivery shipments, we might want to record when they start transit
      // This is optional and can be configured
      return null;
    }

    if (eventType) {
      return await recordShipmentLocation(shipment, eventType);
    }

    return null;
  }, [autoRecordEvents, hasActiveSession, recordShipmentLocation]);

  /**
   * Check if GPS recording is available
   */
  const canRecordLocation = useCallback(() => {
    return hasActiveSession && !isGettingLocation && !isSubmitting;
  }, [hasActiveSession, isGettingLocation, isSubmitting]);

  /**
   * Get recording status for a specific shipment
   */
  const isRecordingForShipment = useCallback((shipmentId: string, eventType?: 'pickup' | 'delivery') => {
    if (eventType) {
      return recordingRef.current.has(`${shipmentId}-${eventType}`);
    }

    // Check if recording any event for this shipment
    return Array.from(recordingRef.current).some(key => key.startsWith(`${shipmentId}-`));
  }, []);

  /**
   * Manually record location for a shipment
   */
  const recordLocationForShipment = useCallback(async (
    shipment: Shipment,
    eventType: 'pickup' | 'delivery'
  ) => {
    return await recordShipmentLocation(shipment, eventType);
  }, [recordShipmentLocation]);

  // Clean up recording set on unmount
  useEffect(() => {
    return () => {
      recordingRef.current.clear();
    };
  }, []);

  return {
    // Status
    hasActiveSession,
    activeSession,
    canRecordLocation: canRecordLocation(),
    isGettingLocation,
    isSubmitting,

    // Actions
    recordLocationForShipment,
    handleStatusChange,

    // Utilities
    isRecordingForShipment,

    // Raw functions for advanced usage
    recordShipmentLocation,
  };
}

/**
 * Hook for tracking multiple shipments
 */
export function useMultipleShipmentTracking(
  shipments: Shipment[],
  employeeId: string,
  options: Omit<ShipmentTrackingOptions, 'employeeId'> = {}
) {
  const tracking = useShipmentTracking({ ...options, employeeId });

  /**
   * Handle status change for any shipment in the list
   */
  const handleShipmentStatusChange = useCallback(async (
    shipmentId: string,
    newStatus: string,
    oldStatus?: string
  ) => {
    const shipment = shipments.find(s => s.shipment_id === shipmentId);
    if (!shipment) {
      console.warn(`Shipment ${shipmentId} not found in tracking list`);
      return null;
    }

    return await tracking.handleStatusChange(shipment, newStatus, oldStatus);
  }, [shipments, tracking]);

  /**
   * Record location for any shipment in the list
   */
  const recordLocationForShipmentId = useCallback(async (
    shipmentId: string,
    eventType: 'pickup' | 'delivery'
  ) => {
    const shipment = shipments.find(s => s.shipment_id === shipmentId);
    if (!shipment) {
      throw new Error(`Shipment ${shipmentId} not found in tracking list`);
    }

    return await tracking.recordLocationForShipment(shipment, eventType);
  }, [shipments, tracking]);

  /**
   * Get shipments that can have their location recorded
   */
  const getTrackableShipments = useCallback(() => {
    if (!tracking.hasActiveSession) {
      return [];
    }

    return shipments.filter(shipment => {
      const canPickup = shipment.type === 'pickup' && shipment.status === 'Assigned';
      const canDeliver = shipment.type === 'delivery' && shipment.status === 'Collected';
      return canPickup || canDeliver;
    });
  }, [shipments, tracking.hasActiveSession]);

  return {
    ...tracking,
    handleShipmentStatusChange,
    recordLocationForShipmentId,
    getTrackableShipments,
    trackableShipments: getTrackableShipments(),
  };
}