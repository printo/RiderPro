import { GPSPosition } from './GPSTracker';
import { OfflineGPSRecord, OfflineRouteSession } from './OfflineStorageService';
import { log } from "../utils/logger.js";

export interface DataConflict {
  id: string;
  type: 'gps_record' | 'route_session';
  localData: OfflineGPSRecord | OfflineRouteSession;
  serverData?: any;
  conflictReason: 'duplicate' | 'timestamp_mismatch' | 'data_mismatch' | 'server_newer';
  timestamp: Date;
}

export interface ConflictResolution {
  action: 'use_local' | 'use_server' | 'merge' | 'skip';
  resolvedData?: any;
  reason: string;
}

export class ConflictResolutionService {
  private conflicts: Map<string, DataConflict> = new Map();
  private resolutionStrategies: Map<string, (conflict: DataConflict) => ConflictResolution> = new Map();

  constructor() {
    this.setupDefaultStrategies();
  }

  /**
   * Setup default conflict resolution strategies
   */
  private setupDefaultStrategies(): void {
    // GPS Record conflicts
    this.resolutionStrategies.set('gps_record_duplicate', (conflict) => {
      return {
        action: 'skip',
        reason: 'GPS record already exists on server'
      };
    });

    this.resolutionStrategies.set('gps_record_timestamp_mismatch', (conflict) => {
      const localRecord = conflict.localData as OfflineGPSRecord;
      const serverData = conflict.serverData;

      // Use the record with the more recent timestamp
      const localTime = new Date(localRecord.timestamp).getTime();
      const serverTime = serverData ? new Date(serverData.timestamp).getTime() : 0;

      if (localTime > serverTime) {
        return {
          action: 'use_local',
          reason: 'Local record has more recent timestamp'
        };
      } else {
        return {
          action: 'use_server',
          reason: 'Server record has more recent timestamp'
        };
      }
    });

    // Route Session conflicts
    this.resolutionStrategies.set('route_session_duplicate', (conflict) => {
      const localSession = conflict.localData as OfflineRouteSession;
      const serverData = conflict.serverData;

      // Merge session data, preferring local for status and end time
      const mergedData = {
        ...serverData,
        status: localSession.status,
        endTime: localSession.endTime || serverData.endTime,
        endPosition: localSession.endPosition || serverData.endPosition
      };

      return {
        action: 'merge',
        resolvedData: mergedData,
        reason: 'Merged local status and end time with server data'
      };
    });

    this.resolutionStrategies.set('route_session_data_mismatch', (conflict) => {
      const localSession = conflict.localData as OfflineRouteSession;

      // For route sessions, local data is usually more authoritative
      // since it reflects the actual user actions
      return {
        action: 'use_local',
        resolvedData: localSession,
        reason: 'Local route session data is more authoritative'
      };
    });
  }

  /**
   * Detect conflicts between local and server data
   */
  detectGPSRecordConflict(
    localRecord: OfflineGPSRecord,
    serverRecord?: any
  ): DataConflict | null {
    if (!serverRecord) {
      return null; // No conflict if server record doesn't exist
    }

    const conflictId = `gps_${localRecord.id}`;
    let conflictReason: DataConflict['conflictReason'] = 'duplicate';

    // Check for timestamp mismatch
    const localTime = new Date(localRecord.timestamp).getTime();
    const serverTime = new Date(serverRecord.timestamp).getTime();
    const timeDiff = Math.abs(localTime - serverTime);

    if (timeDiff > 60000) { // More than 1 minute difference
      conflictReason = 'timestamp_mismatch';
    }

    // Check for position data mismatch
    const positionDiff = this.calculatePositionDifference(
      localRecord.position,
      {
        latitude: serverRecord.latitude,
        longitude: serverRecord.longitude,
        accuracy: serverRecord.accuracy,
        speed: serverRecord.speed,
        timestamp: serverRecord.timestamp
      }
    );

    if (positionDiff > 100) { // More than 100 meters difference
      conflictReason = 'data_mismatch';
    }

    const conflict: DataConflict = {
      id: conflictId,
      type: 'gps_record',
      localData: localRecord,
      serverData: serverRecord,
      conflictReason,
      timestamp: new Date()
    };

    this.conflicts.set(conflictId, conflict);
    return conflict;
  }

  /**
   * Detect conflicts for route sessions
   */
  detectRouteSessionConflict(
    localSession: OfflineRouteSession,
    serverSession?: any
  ): DataConflict | null {
    if (!serverSession) {
      return null; // No conflict if server session doesn't exist
    }

    const conflictId = `session_${localSession.id}`;
    let conflictReason: DataConflict['conflictReason'] = 'duplicate';

    // Check if server data is newer
    const localUpdate = new Date(localSession.endTime || localSession.startTime).getTime();
    const serverUpdate = new Date(serverSession.endTime || serverSession.startTime).getTime();

    if (serverUpdate > localUpdate) {
      conflictReason = 'server_newer';
    }

    // Check for status mismatch
    if (localSession.status !== serverSession.status) {
      conflictReason = 'data_mismatch';
    }

    const conflict: DataConflict = {
      id: conflictId,
      type: 'route_session',
      localData: localSession,
      serverData: serverSession,
      conflictReason,
      timestamp: new Date()
    };

    this.conflicts.set(conflictId, conflict);
    return conflict;
  }

  /**
   * Resolve a conflict using the appropriate strategy
   */
  resolveConflict(conflictId: string): ConflictResolution | null {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      return null;
    }

    const strategyKey = `${conflict.type}_${conflict.conflictReason}`;
    const strategy = this.resolutionStrategies.get(strategyKey);

    if (strategy) {
      const resolution = strategy(conflict);
      log.dev(`Resolved conflict ${conflictId}:`, resolution);
      return resolution;
    }

    // Default resolution: use local data
    return {
      action: 'use_local',
      reason: 'No specific strategy found, defaulting to local data'
    };
  }

  /**
   * Resolve all pending conflicts
   */
  resolveAllConflicts(): Map<string, ConflictResolution> {
    const resolutions = new Map<string, ConflictResolution>();

    for (const [conflictId, conflict] of Array.from(this.conflicts.entries())) {
      const resolution = this.resolveConflict(conflictId);
      if (resolution) {
        resolutions.set(conflictId, resolution);
      }
    }

    return resolutions;
  }

  /**
   * Get all pending conflicts
   */
  getPendingConflicts(): DataConflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Clear resolved conflicts
   */
  clearResolvedConflicts(conflictIds: string[]): void {
    for (const id of conflictIds) {
      this.conflicts.delete(id);
    }
  }

  /**
   * Clear all conflicts
   */
  clearAllConflicts(): void {
    this.conflicts.clear();
  }

  /**
   * Add custom resolution strategy
   */
  addResolutionStrategy(
    key: string,
    strategy: (conflict: DataConflict) => ConflictResolution
  ): void {
    this.resolutionStrategies.set(key, strategy);
  }

  /**
   * Calculate distance between two GPS positions
   */
  private calculatePositionDifference(pos1: GPSPosition, pos2: GPSPosition): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(pos2.latitude - pos1.latitude);
    const dLon = this.toRadians(pos2.longitude - pos1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(pos1.latitude)) * Math.cos(this.toRadians(pos2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get conflict statistics
   */
  getConflictStats(): {
    total: number;
    byType: Record<string, number>;
    byReason: Record<string, number>;
  } {
    const stats = {
      total: this.conflicts.size,
      byType: {} as Record<string, number>,
      byReason: {} as Record<string, number>
    };

    for (const conflict of Array.from(this.conflicts.values())) {
      stats.byType[conflict.type] = (stats.byType[conflict.type] || 0) + 1;
      stats.byReason[conflict.conflictReason] = (stats.byReason[conflict.conflictReason] || 0) + 1;
    }

    return stats;
  }

  /**
   * Check if there are any unresolved conflicts
   */
  hasUnresolvedConflicts(): boolean {
    return this.conflicts.size > 0;
  }

  /**
   * Get conflicts by type
   */
  getConflictsByType(type: 'gps_record' | 'route_session'): DataConflict[] {
    return Array.from(this.conflicts.values()).filter(conflict => conflict.type === type);
  }

  /**
   * Validate resolution data
   */
  validateResolution(resolution: ConflictResolution, conflict: DataConflict): boolean {
    switch (resolution.action) {
      case 'use_local':
        return conflict.localData !== undefined;

      case 'use_server':
        return conflict.serverData !== undefined;

      case 'merge':
        return resolution.resolvedData !== undefined;

      case 'skip':
        return true;

      default:
        return false;
    }
  }
}