import { useState, useEffect, useCallback, useRef } from 'react';
import { OfflineStorageService } from '@/services/OfflineStorageService';
import { DeviceSyncStatus as SyncStatus } from '@shared/types';
import { GPSPosition } from '@shared/types';

export interface OfflineSyncConfig {
  autoSyncInterval: number; // milliseconds
  maxRetryAttempts: number;
  syncOnReconnect: boolean;
  clearSyncedDataInterval: number; // milliseconds
}

export interface UseOfflineSyncProps {
  config?: Partial<OfflineSyncConfig>;
  onSyncComplete?: (status: SyncStatus) => void;
  onSyncError?: (error: string) => void;
}

const DEFAULT_CONFIG: OfflineSyncConfig = {
  autoSyncInterval: 60000, // 1 minute
  maxRetryAttempts: 5,
  syncOnReconnect: true,
  clearSyncedDataInterval: 3600000 // 1 hour
};

export function useOfflineSync({
  config = {},
  onSyncComplete,
  onSyncError
}: UseOfflineSyncProps = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    pendingRecords: 0,
    syncInProgress: false,
    syncErrors: []
  });

  const offlineStorageRef = useRef<OfflineStorageService | null>(null);
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize offline storage service
  useEffect(() => {
    offlineStorageRef.current = new OfflineStorageService();

    // Listen for sync status updates
    const handleSyncStatusUpdate = (status: SyncStatus) => {
      setSyncStatus(status);

      if (!status.syncInProgress && status.syncErrors.length === 0) {
        onSyncComplete?.(status);
      } else if (status.syncErrors.length > 0) {
        onSyncError?.(status.syncErrors.join(', '));
      }
    };

    offlineStorageRef.current.addSyncStatusListener(handleSyncStatusUpdate);

    // Setup auto-sync interval
    if (fullConfig.autoSyncInterval > 0) {
      autoSyncIntervalRef.current = setInterval(() => {
        if (navigator.onLine && !syncStatus.syncInProgress) {
          offlineStorageRef.current?.startBackgroundSync();
        }
      }, fullConfig.autoSyncInterval);
    }

    // Setup cleanup interval for synced data
    if (fullConfig.clearSyncedDataInterval > 0) {
      cleanupIntervalRef.current = setInterval(() => {
        offlineStorageRef.current?.clearSyncedRecords().catch(error => {
          console.error('Failed to clear synced records:', error);
        });
      }, fullConfig.clearSyncedDataInterval);
    }

    return () => {
      if (offlineStorageRef.current) {
        offlineStorageRef.current.removeSyncStatusListener(handleSyncStatusUpdate);
      }

      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }

      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [fullConfig.autoSyncInterval, fullConfig.clearSyncedDataInterval, onSyncComplete, onSyncError]);

  /**
   * Store GPS position offline
   */
  const storeGPSPositionOffline = useCallback(async (sessionId: string, position: GPSPosition): Promise<string> => {
    if (!offlineStorageRef.current) {
      throw new Error('Offline storage not initialized');
    }

    return offlineStorageRef.current.storeGPSRecord(sessionId, position);
  }, []);

  /**
   * Store route session offline
   */
  const storeRouteSessionOffline = useCallback(async (session: {
    id: string;
    employeeId: string;
    startTime: string;
    endTime?: string;
    status: 'active' | 'completed' | 'paused';
    startPosition: GPSPosition;
    endPosition?: GPSPosition;
  }): Promise<void> => {
    if (!offlineStorageRef.current) {
      throw new Error('Offline storage not initialized');
    }

    return offlineStorageRef.current.storeRouteSession(session);
  }, []);

  /**
   * Force sync now
   */
  const forceSyncNow = useCallback(async (): Promise<void> => {
    if (!offlineStorageRef.current) {
      throw new Error('Offline storage not initialized');
    }

    if (!syncStatus.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    return offlineStorageRef.current.forceSyncNow();
  }, [syncStatus.isOnline]);

  /**
   * Clear synced data manually
   */
  const clearSyncedData = useCallback(async (): Promise<void> => {
    if (!offlineStorageRef.current) {
      throw new Error('Offline storage not initialized');
    }

    return offlineStorageRef.current.clearSyncedRecords();
  }, []);

  /**
   * Get detailed sync status
   */
  const getDetailedSyncStatus = useCallback(async () => {
    if (!offlineStorageRef.current) {
      return null;
    }

    try {
      const [unsyncedGPS, unsyncedSessions] = await Promise.all([
        offlineStorageRef.current.getUnsyncedGPSRecords(),
        offlineStorageRef.current.getUnsyncedRouteSessions()
      ]);

      return {
        ...syncStatus,
        unsyncedGPSRecords: unsyncedGPS.length,
        unsyncedSessions: unsyncedSessions.length,
        totalPending: unsyncedGPS.length + unsyncedSessions.length
      };
    } catch (error) {
      console.error('Failed to get detailed sync status:', error);
      return null;
    }
  }, [syncStatus]);

  /**
   * Check if we should store data offline
   */
  const shouldStoreOffline = useCallback((): boolean => {
    return !syncStatus.isOnline || syncStatus.syncInProgress;
  }, [syncStatus.isOnline, syncStatus.syncInProgress]);

  /**
   * Get sync health status
   */
  const getSyncHealth = useCallback(() => {
    const now = Date.now();
    const lastSyncTime = syncStatus.lastSyncTime?.getTime() || 0;
    const timeSinceLastSync = now - lastSyncTime;

    let health: 'good' | 'warning' | 'error' = 'good';
    let message = 'Sync is healthy';

    if (!syncStatus.isOnline) {
      health = 'warning';
      message = 'Device is offline';
    } else if (syncStatus.pendingRecords > 100) {
      health = 'warning';
      message = `${syncStatus.pendingRecords} records pending sync`;
    } else if (syncStatus.syncErrors.length > 0) {
      health = 'error';
      message = `Sync errors: ${syncStatus.syncErrors.length}`;
    } else if (timeSinceLastSync > fullConfig.autoSyncInterval * 3) {
      health = 'warning';
      message = 'Sync overdue';
    }

    return { health, message, timeSinceLastSync };
  }, [syncStatus, fullConfig.autoSyncInterval]);

  return {
    // Status
    syncStatus,
    isOnline: syncStatus.isOnline,
    pendingRecords: syncStatus.pendingRecords,
    syncInProgress: syncStatus.syncInProgress,
    syncErrors: syncStatus.syncErrors,
    lastSyncTime: syncStatus.lastSyncTime,

    // Actions
    storeGPSPositionOffline,
    storeRouteSessionOffline,
    forceSyncNow,
    clearSyncedData,
    shouldStoreOffline,

    // Status helpers
    getDetailedSyncStatus,
    getSyncHealth,

    // Configuration
    config: fullConfig
  };
}