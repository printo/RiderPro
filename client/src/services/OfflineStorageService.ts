import {
  GPSPosition, OfflineGPSRecord, OfflineRouteSession, ServerConflict,
  DeviceSyncStatus as SyncStatus, DataConflict, ConflictResolution, ServerGPSRecord
} from '@shared/types';
import { ConflictResolutionService } from './ConflictResolutionService';
import { log } from "../utils/logger.js";
import config from '../config';
import { apiRequest } from '@/lib/queryClient';

export class OfflineStorageService {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'RouteTrackingOffline';
  private initialized = false;
  private readonly dbVersion = 1;
  private syncStatus: SyncStatus = {
    is_online: navigator.onLine,
    pending_records: 0,
    sync_in_progress: false,
    sync_errors: []
  };
  private syncListeners: ((status: SyncStatus) => void)[] = [];
  private conflictResolver: ConflictResolutionService;

  constructor() {
    this.conflictResolver = new ConflictResolutionService();
    this.initializeDB();
    this.setupNetworkListeners();
  }

  /**
   * Initialize IndexedDB database
   */
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        if (!this.initialized) {
          // Only log in development mode
          if (config.debug) {
            log.dev('IndexedDB initialized successfully');
          }
          this.initialized = true;
        }
        this.updatePendingCount();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // GPS Records store
        if (!db.objectStoreNames.contains('gpsRecords')) {
          const gpsStore = db.createObjectStore('gpsRecords', { keyPath: 'id' });
          gpsStore.createIndex('session_id', 'session_id', { unique: false });
          gpsStore.createIndex('synced', 'synced', { unique: false });
          gpsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Route Sessions store
        if (!db.objectStoreNames.contains('routeSessions')) {
          const sessionStore = db.createObjectStore('routeSessions', { keyPath: 'id' });
          sessionStore.createIndex('employee_id', 'employee_id', { unique: false });
          sessionStore.createIndex('synced', 'synced', { unique: false });
          sessionStore.createIndex('status', 'status', { unique: false });
        }

        log.dev('IndexedDB schema created/updated');
      };
    });
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      log.dev('Network connection restored');
      this.syncStatus.is_online = true;
      this.notifySyncListeners();
      this.startBackgroundSync();
    });

    window.addEventListener('offline', () => {
      log.dev('Network connection lost');
      this.syncStatus.is_online = false;
      this.notifySyncListeners();
    });
  }

  /**
   * Store GPS record offline
   */
  async storeGPSRecord(sessionId: string, position: GPSPosition): Promise<string> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    const record: OfflineGPSRecord = {
      id: `gps-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      session_id: sessionId,
      position,
      timestamp: new Date().toISOString(),
      synced: false,
      sync_attempts: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gpsRecords'], 'readwrite');
      const store = transaction.objectStore('gpsRecords');
      const request = store.add(record);

      request.onsuccess = () => {
        log.dev('GPS record stored offline:', record.id);
        this.updatePendingCount();
        resolve(record.id);
      };

      request.onerror = () => {
        console.error('Failed to store GPS record:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Store route session offline
   */
  async storeRouteSession(session: Omit<OfflineRouteSession, 'synced' | 'sync_attempts'>): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    const offlineSession: OfflineRouteSession = {
      ...session,
      synced: false,
      sync_attempts: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['routeSessions'], 'readwrite');
      const store = transaction.objectStore('routeSessions');
      const request = store.put(offlineSession);

      request.onsuccess = () => {
        log.dev('Route session stored offline:', session.id);
        this.updatePendingCount();
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to store route session:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get unsynced GPS records
   */
  async getUnsyncedGPSRecords(): Promise<OfflineGPSRecord[]> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, _reject) => {
      try {
        const transaction = this.db!.transaction(['gpsRecords'], 'readonly');
        const store = transaction.objectStore('gpsRecords');

        // Get all records and filter manually to avoid IDBKeyRange issues
        const request = store.getAll();

        request.onsuccess = () => {
          try {
            const allRecords = request.result;
            const unsyncedRecords = allRecords.filter(record =>
              record.synced === false || record.synced == null || record.synced === undefined
            );
            resolve(unsyncedRecords);
          } catch (filterError) {
            console.error('Error filtering unsynced records:', filterError);
            resolve([]); // Return empty array on error
          }
        };

        request.onerror = () => {
          console.error('Failed to get unsynced GPS records:', request.error);
          resolve([]); // Return empty array instead of rejecting
        };
      } catch (error) {
        console.error('Error in getUnsyncedGPSRecords:', error);
        resolve([]); // Return empty array on error to prevent crashes
      }
    });
  }

  /**
   * Get unsynced route sessions
   */
  async getUnsyncedRouteSessions(): Promise<OfflineRouteSession[]> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, _reject) => {
      try {
        const transaction = this.db!.transaction(['routeSessions'], 'readonly');
        const store = transaction.objectStore('routeSessions');

        // Get all records and filter manually to avoid IDBKeyRange issues
        const request = store.getAll();

        request.onsuccess = () => {
          try {
            const allRecords = request.result;
            const unsyncedRecords = allRecords.filter(record =>
              record.synced === false || record.synced == null || record.synced === undefined
            );
            resolve(unsyncedRecords);
          } catch (filterError) {
            console.error('Error filtering unsynced sessions:', filterError);
            resolve([]); // Return empty array on error
          }
        };

        request.onerror = () => {
          console.error('Failed to get unsynced route sessions:', request.error);
          resolve([]); // Return empty array instead of rejecting
        };
      } catch (error) {
        console.error('Error in getUnsyncedRouteSessions:', error);
        resolve([]); // Return empty array on error to prevent crashes
      }
    });
  }

  /**
   * Mark GPS record as synced
   */
  async markGPSRecordSynced(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gpsRecords'], 'readwrite');
      const store = transaction.objectStore('gpsRecords');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.synced = true;
          record.last_sync_attempt = new Date().toISOString();

          const putRequest = store.put(record);
          putRequest.onsuccess = () => {
            this.updatePendingCount();
            resolve();
          };
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Record not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Mark route session as synced
   */
  async markRouteSessionSynced(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['routeSessions'], 'readwrite');
      const store = transaction.objectStore('routeSessions');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const session = getRequest.result;
        if (session) {
          session.synced = true;
          session.last_sync_attempt = new Date().toISOString();

          const putRequest = store.put(session);
          putRequest.onsuccess = () => {
            this.updatePendingCount();
            resolve();
          };
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Session not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Increment sync attempt count for failed syncs
   */
  async incrementSyncAttempt(type: 'gps' | 'session', id: string): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    const storeName = type === 'gps' ? 'gpsRecords' : 'routeSessions';

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.sync_attempts = (record.sync_attempts || 0) + 1;
          record.last_sync_attempt = new Date().toISOString();

          const putRequest = store.put(record);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Record not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Start background sync process
   */
  async startBackgroundSync(): Promise<void> {
    if (!this.syncStatus.is_online || this.syncStatus.sync_in_progress) {
      return;
    }

    this.syncStatus.sync_in_progress = true;
    this.syncStatus.sync_errors = [];
    this.notifySyncListeners();

    try {
      log.dev('Starting background sync...');

      // Sync route sessions first
      await this.syncRouteSessions();

      // Then sync GPS records
      await this.syncGPSRecords();

      this.syncStatus.last_sync_at = new Date();
      log.dev('Background sync completed successfully');

    } catch (error) {
      console.error('Background sync failed:', error);
      this.syncStatus.sync_errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    } finally {
      this.syncStatus.sync_in_progress = false;
      this.notifySyncListeners();
    }
  }

  /**
   * Sync route sessions to server
   */
  private async syncRouteSessions(): Promise<void> {
    const unsyncedSessions = await this.getUnsyncedRouteSessions();
    log.dev(`Syncing ${unsyncedSessions.length} route sessions...`);

    for (const session of unsyncedSessions) {
      try {
        // Skip if too many failed attempts
        if (session.sync_attempts >= 5) {
          console.warn(`Skipping session ${session.id} - too many failed attempts`);
          continue;
        }

        const response = await apiRequest('POST', '/api/v1/routes/sync-session', {
          id: session.id,
          employee_id: session.employee_id,
          start_time: session.start_time,
          end_time: session.end_time,
          status: session.status,
          start_latitude: session.start_position.latitude,
          start_longitude: session.start_position.longitude,
          end_latitude: session.end_position?.latitude,
          end_longitude: session.end_position?.longitude
        });

        if (response.ok) {
          await this.markRouteSessionSynced(session.id);
          log.dev(`Route session ${session.id} synced successfully`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        console.error(`Failed to sync route session ${session.id}:`, error);
        await this.incrementSyncAttempt('session', session.id);
        this.syncStatus.sync_errors.push(`Session ${session.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Sync GPS records to server
   */
  private async syncGPSRecords(): Promise<void> {
    const unsyncedRecords = await this.getUnsyncedGPSRecords();
    log.dev(`Syncing ${unsyncedRecords.length} GPS records...`);

    // Group records by session for batch sync
    const recordsBySession = new Map<string, OfflineGPSRecord[]>();

    for (const record of unsyncedRecords) {
      if (record.sync_attempts >= 5) {
        console.warn(`Skipping GPS record ${record.id} - too many failed attempts`);
        continue;
      }

      if (!recordsBySession.has(record.session_id)) {
        recordsBySession.set(record.session_id, []);
      }
      recordsBySession.get(record.session_id)!.push(record);
    }

    // Sync records in batches by session
    for (const [sessionId, records] of Array.from(recordsBySession.entries())) {
      try {
        const coordinates = records.map(record => ({
          latitude: record.position.latitude,
          longitude: record.position.longitude,
          timestamp: record.position.timestamp,
          accuracy: record.position.accuracy
        }));

        const response = await apiRequest('POST', '/api/v1/routes/sync-coordinates', {
          session_id: sessionId,
          coordinates
        });

        if (response.ok) {
          // Mark all records in this batch as synced
          for (const record of records) {
            await this.markGPSRecordSynced(record.id);
          }
          log.dev(`${records.length} GPS records synced for session ${sessionId}`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        console.error(`Failed to sync GPS records for session ${sessionId}:`, error);

        // Increment sync attempts for all records in this batch
        for (const record of records) {
          await this.incrementSyncAttempt('gps', record.id);
        }

        this.syncStatus.sync_errors.push(`GPS batch ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Update pending records count
   */
  private async updatePendingCount(): Promise<void> {
    try {
      const [gpsRecords, sessions] = await Promise.all([
        this.getUnsyncedGPSRecords(),
        this.getUnsyncedRouteSessions()
      ]);

      this.syncStatus.pending_records = gpsRecords.length + sessions.length;
      this.notifySyncListeners();
    } catch (error) {
      console.error('Failed to update pending count:', error);
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Add sync status listener
   */
  addSyncStatusListener(listener: (status: SyncStatus) => void): void {
    this.syncListeners.push(listener);
  }

  /**
   * Remove sync status listener
   */
  removeSyncStatusListener(listener: (status: SyncStatus) => void): void {
    const index = this.syncListeners.indexOf(listener);
    if (index > -1) {
      this.syncListeners.splice(index, 1);
    }
  }

  /**
   * Notify all sync status listeners
   */
  private notifySyncListeners(): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(this.syncStatus);
      } catch (error) {
        console.error('Error in sync status listener:', error);
      }
    });
  }

  /**
   * Clear all synced records (cleanup)
   */
  async clearSyncedRecords(): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    const transaction = this.db.transaction(['gpsRecords', 'routeSessions'], 'readwrite');

    // Clear synced GPS records - use a more robust approach
    const gpsStore = transaction.objectStore('gpsRecords');
    const gpsRequest = gpsStore.openCursor();

    gpsRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const record = cursor.value;
        // Check if synced is truthy (handles boolean true, string "true", number 1, etc.)
        if (record.synced === true || record.synced === "true" || record.synced === 1) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    // Clear synced route sessions - use a more robust approach
    const sessionStore = transaction.objectStore('routeSessions');
    const sessionRequest = sessionStore.openCursor();

    sessionRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const record = cursor.value;
        // Check if synced is truthy (handles boolean true, string "true", number 1, etc.)
        if (record.synced === true || record.synced === "true" || record.synced === 1) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        log.dev('Synced records cleared');
        this.updatePendingCount();
        resolve();
      };

      transaction.onerror = () => {
        console.error('Failed to clear synced records:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Force sync now (manual trigger)
   */
  async forceSyncNow(): Promise<void> {
    if (!this.syncStatus.is_online) {
      throw new Error('Cannot sync while offline');
    }

    await this.startBackgroundSync();
  }

  /**
   * Handle sync conflicts
   */
  private async handleSyncConflicts(conflicts: ServerConflict[], localRecords: OfflineGPSRecord[]): Promise<void> {
    for (const serverConflict of conflicts) {
      const localRecord = localRecords.find((r: OfflineGPSRecord) => r.id === serverConflict.local_id);
      if (!localRecord) continue;

      const conflict = this.conflictResolver.detectGPSRecordConflict(localRecord, serverConflict.server_data as ServerGPSRecord);
      if (conflict) {
        const resolution = this.conflictResolver.resolveConflict(conflict.id);
        if (resolution) {
          await this.applyConflictResolution(conflict, resolution);
        }
      }
    }
  }

  /**
   * Apply conflict resolution
   */
  private async applyConflictResolution(conflict: DataConflict, resolution: ConflictResolution): Promise<void> {
    switch (resolution.action) {
      case 'use_local':
        // Keep local data, mark as synced
        if (conflict.type === 'gps_record') {
          await this.markGPSRecordSynced(conflict.local_data.id);
        } else {
          await this.markRouteSessionSynced(conflict.local_data.id);
        }
        break;

      case 'use_server':
        // Replace local data with server data
        // For now, just mark as synced since server has the authoritative data
        if (conflict.type === 'gps_record') {
          await this.markGPSRecordSynced(conflict.local_data.id);
        } else {
          await this.markRouteSessionSynced(conflict.local_data.id);
        }
        break;

      case 'merge':
        // Apply merged data (would need server support for this)
        log.dev('Merge resolution not fully implemented yet');
        break;

      case 'skip':
        // Skip this record, mark as synced to avoid future conflicts
        if (conflict.type === 'gps_record') {
          await this.markGPSRecordSynced(conflict.local_data.id);
        } else {
          await this.markRouteSessionSynced(conflict.local_data.id);
        }
        break;
    }

    log.dev(`Applied conflict resolution for ${conflict.id}:`, resolution.action);
  }

  /**
   * Get conflict resolver instance
   */
  getConflictResolver(): ConflictResolutionService {
    return this.conflictResolver;
  }

  /**
   * Get sync conflicts
   */
  getSyncConflicts(): DataConflict[] {
    return this.conflictResolver.getAllConflicts();
  }

  /**
   * Resolve all conflicts manually
   */
  async resolveAllConflicts(): Promise<void> {
    const resolutions = this.conflictResolver.resolveAllConflicts();
    const conflicts = this.conflictResolver.getAllConflicts();

    for (const conflict of conflicts) {
      const resolution = resolutions.get(conflict.id);
      if (resolution) {
        await this.applyConflictResolution(conflict, resolution);
      }
    }

    this.conflictResolver.clearConflicts();
  }
}