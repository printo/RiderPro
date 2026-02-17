import {
  GPSPosition,
  OfflineGPSRecord,
  OfflineRouteSession,
  ServerGPSRecord,
  ServerRouteSession,
  ServerData,
  DataConflict,
  ConflictResolution
} from '@shared/types';

type ResolutionStrategy<T extends ServerData> = (conflict: DataConflict<T>) => ConflictResolution<T>;

type ConflictMap = {
  gps: Map<string, DataConflict<ServerGPSRecord>>;
  route: Map<string, DataConflict<ServerRouteSession>>;
};

export class ConflictResolutionService {
  private conflicts: ConflictMap = {
    gps: new Map(),
    route: new Map()
  };

  private resolutionStrategies = new Map<string, ResolutionStrategy<ServerData>>();

  constructor() {
    this.setupDefaultStrategies();
  }

  /**
   * Setup default conflict resolution strategies
   */
  private setupDefaultStrategies(): void {
    // GPS Record conflicts
    this.resolutionStrategies.set('gps_record_duplicate', (_conflict) => ({
      action: 'skip',
      reason: 'GPS record already exists on server'
    }));

    this.resolutionStrategies.set('gps_record_timestamp_mismatch', (conflict) => {
      const localRecord = conflict.local_data as OfflineGPSRecord;
      const serverData = conflict.server_data as ServerGPSRecord;

      // Use the record with the more recent timestamp
      const localTime = new Date(localRecord.timestamp).getTime();
      const serverTime = new Date(serverData.timestamp).getTime();

      if (localTime > serverTime) {
        return {
          action: 'use_local',
          reason: 'Local record has more recent timestamp'
        } as ConflictResolution<ServerGPSRecord>;
      } else {
        return {
          action: 'use_server',
          reason: 'Server record has more recent timestamp'
        } as ConflictResolution<ServerGPSRecord>;
      }
    });

    // Route Session conflicts
    this.resolutionStrategies.set('route_session_duplicate', (conflict) => {
      const localSession = conflict.local_data as OfflineRouteSession;
      const serverData = conflict.server_data as ServerRouteSession;

      // Merge session data, preferring local for status and end time
      const mergedData: ServerRouteSession = {
        ...serverData,
        status: localSession.status,
        end_time: localSession.end_time || serverData.end_time,
        end_position: localSession.end_position || serverData.end_position
      };

      return {
        action: 'merge',
        resolved_data: mergedData,
        reason: 'Merged local status and end time with server data'
      } as ConflictResolution<ServerRouteSession>;
    });

    this.resolutionStrategies.set('route_session_data_mismatch', () => ({
      action: 'use_local',
      reason: 'Local route session data is more authoritative'
    }));
  }

  /**
   * Detect conflicts between local and server data
   */
  detectGPSRecordConflict(
    localRecord: OfflineGPSRecord,
    serverRecord?: ServerGPSRecord
  ): DataConflict<ServerGPSRecord> | null {
    if (!serverRecord) {
      return null; // No conflict if server record doesn't exist
    }

    const conflictId = `gps_${localRecord.id}`;
    let conflictReason: DataConflict['conflict_reason'] = 'duplicate';

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

    const conflict: DataConflict<ServerGPSRecord> = {
      id: conflictId,
      type: 'gps_record',
      local_data: localRecord,
      server_data: serverRecord,
      conflict_reason: conflictReason,
      timestamp: new Date()
    };

    this.conflicts.gps.set(conflictId, conflict);
    return conflict;
  }

  /**
   * Detect conflicts for route sessions
   */
  detectRouteSessionConflict(
    localSession: OfflineRouteSession,
    serverSession?: ServerRouteSession
  ): DataConflict<ServerRouteSession> | null {
    if (!serverSession) {
      return null; // No conflict if server session doesn't exist
    }

    const conflictId = `session_${localSession.id}`;
    let conflictReason: DataConflict['conflict_reason'] = 'duplicate';

    // Check if server data is newer
    const localUpdate = new Date(localSession.end_time || localSession.start_time).getTime();
    const serverUpdate = new Date(serverSession.end_time || serverSession.start_time).getTime();

    if (serverUpdate > localUpdate) {
      conflictReason = 'server_newer';
    }

    // Check for status mismatch
    if (localSession.status !== serverSession.status) {
      conflictReason = 'data_mismatch';
    }

    const conflict: DataConflict<ServerRouteSession> = {
      id: conflictId,
      type: 'route_session',
      local_data: localSession,
      server_data: serverSession,
      conflict_reason: conflictReason,
      timestamp: new Date()
    };

    this.conflicts.route.set(conflictId, conflict);
    return conflict;
  }

  /**
   * Resolve a conflict using the appropriate strategy
   */
  resolveConflict(conflictId: string): ConflictResolution<ServerData> | undefined {
    // Try to find the conflict in GPS conflicts
    const gpsConflict = this.conflicts.gps.get(conflictId);
    if (gpsConflict) {
      const strategyKey = `gps_record_${gpsConflict.conflict_reason}`.toLowerCase();
      const strategy = this.resolutionStrategies.get(strategyKey);

      if (strategy) {
        return strategy(gpsConflict);
      }
    }

    // Try to find the conflict in Route session conflicts
    const routeConflict = this.conflicts.route.get(conflictId);
    if (routeConflict) {
      const strategyKey = `route_session_${routeConflict.conflict_reason}`.toLowerCase();
      const strategy = this.resolutionStrategies.get(strategyKey);

      if (strategy) {
        return strategy(routeConflict);
      }
    }

    // Default strategy if no specific strategy found
    return {
      action: 'use_server',
      reason: 'No specific resolution strategy found, using server data as fallback'
    };
  }

  /**
   * Resolve all pending conflicts
   */
  resolveAllConflicts(): Map<string, ConflictResolution<ServerData>> {
    const resolutions = new Map<string, ConflictResolution<ServerData>>();

    // Process GPS conflicts
    for (const [conflictId] of Array.from(this.conflicts.gps.entries())) {
      const resolution = this.resolveConflict(conflictId);
      if (resolution) {
        resolutions.set(conflictId, resolution);
      }
    }

    // Process Route session conflicts
    for (const [conflictId] of Array.from(this.conflicts.route.entries())) {
      const resolution = this.resolveConflict(conflictId);
      if (resolution) {
        resolutions.set(conflictId, resolution);
      }
    }

    return resolutions;
  }

  /**
   * Get all conflicts
   */
  getAllConflicts(): DataConflict<ServerData>[] {
    return [
      ...Array.from(this.conflicts.gps.values()),
      ...Array.from(this.conflicts.route.values())
    ];
  }

  /**
   * Remove a resolved conflict
   */
  removeConflict(conflictId: string): boolean {
    // Try to remove from GPS conflicts first
    if (this.conflicts.gps.has(conflictId)) {
      return this.conflicts.gps.delete(conflictId);
    }
    // Then try route conflicts
    if (this.conflicts.route.has(conflictId)) {
      return this.conflicts.route.delete(conflictId);
    }
    return false;
  }

  /**
   * Clear all conflicts
   */
  clearConflicts(): void {
    this.conflicts.gps.clear();
    this.conflicts.route.clear();
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
   * Get conflict statistics
   */
  getConflictStats(): {
    total: number;
    byType: Record<string, number>;
    byReason: Record<string, number>;
  } {
    const stats = {
      total: this.getConflictCount(),
      byType: {} as Record<string, number>,
      byReason: {} as Record<string, number>
    };

    for (const conflict of this.getAllConflicts()) {
      stats.byType[conflict.type] = (stats.byType[conflict.type] || 0) + 1;
      stats.byReason[conflict.conflict_reason] = (stats.byReason[conflict.conflict_reason] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get the number of pending conflicts
   */
  getConflictCount(): number {
    return this.conflicts.gps.size + this.conflicts.route.size;
  }

  /**
   * Find conflicts by type
   */
  findConflictsByType(type: 'gps_record' | 'route_session'): DataConflict<ServerData>[] {
    if (type === 'gps_record') {
      return Array.from(this.conflicts.gps.values());
    } else {
      return Array.from(this.conflicts.route.values());
    }
  }

  private calculatePositionDifference(pos1: GPSPosition, pos2: GPSPosition): number {
    const R = 6371e3; // metres
    const φ1 = pos1.latitude * Math.PI / 180; // φ, λ in radians
    const φ2 = pos2.latitude * Math.PI / 180;
    const Δφ = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const Δλ = (pos2.longitude - pos1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }

  /**
   * Validate resolution data
   */
  validateResolution(resolution: ConflictResolution, conflict: DataConflict): boolean {
    switch (resolution.action) {
      case 'use_local':
        return conflict.local_data !== undefined;

      case 'use_server':
        return conflict.server_data !== undefined;

      case 'merge':
        return resolution.resolved_data !== undefined;

      case 'skip':
        return true;

      default:
        return false;
    }
  }
}