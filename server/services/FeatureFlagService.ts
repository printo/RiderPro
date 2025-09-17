import { Database } from 'better-sqlite3';
import config, { FeatureFlags } from '../config';

// Feature flag configuration
interface FeatureFlagConfig {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  targetUsers?: string[];
  targetRoles?: string[];
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, any>;
}

// Feature flag evaluation context
interface EvaluationContext {
  userId?: string;
  userRole?: string;
  employeeId?: string;
  environment?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

// Feature flag evaluation result
interface EvaluationResult {
  enabled: boolean;
  reason: string;
  metadata?: Record<string, any>;
}

class FeatureFlagService {
  private static instance: FeatureFlagService;
  private db: Database;
  private cache: Map<string, FeatureFlagConfig> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate: number = 0;
  private listeners: Map<string, ((enabled: boolean) => void)[]> = new Map();

  private constructor(database: Database) {
    this.db = database;
    this.initializeFeatureFlags();
    this.loadFeatureFlags();
  }

  public static getInstance(database?: Database): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      if (!database) {
        throw new Error('Database required for first initialization');
      }
      FeatureFlagService.instance = new FeatureFlagService(database);
    }
    return FeatureFlagService.instance;
  }

  private initializeFeatureFlags(): void {
    try {
      // Ensure feature flags table exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS feature_flags (
          name TEXT PRIMARY KEY,
          enabled BOOLEAN NOT NULL DEFAULT 0,
          description TEXT,
          rollout_percentage INTEGER DEFAULT 0,
          target_users TEXT,
          target_roles TEXT,
          start_date TEXT,
          end_date TEXT,
          metadata TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          updated_by TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled 
          ON feature_flags(enabled);
      `);

      console.log('✓ Feature flags table initialized');
    } catch (error) {
      console.error('Failed to initialize feature flags table:', error);
    }
  }

  private loadFeatureFlags(): void {
    try {
      const flags = this.db.prepare(`
        SELECT * FROM feature_flags
      `).all() as any[];

      this.cache.clear();
      flags.forEach(flag => {
        const config: FeatureFlagConfig = {
          name: flag.name,
          enabled: Boolean(flag.enabled),
          description: flag.description,
          rolloutPercentage: flag.rollout_percentage,
          targetUsers: flag.target_users ? JSON.parse(flag.target_users) : undefined,
          targetRoles: flag.target_roles ? JSON.parse(flag.target_roles) : undefined,
          startDate: flag.start_date,
          endDate: flag.end_date,
          metadata: flag.metadata ? JSON.parse(flag.metadata) : undefined
        };
        this.cache.set(flag.name, config);
      });

      this.lastCacheUpdate = Date.now();
      console.log(`✓ Loaded ${flags.length} feature flags`);
    } catch (error) {
      console.error('Failed to load feature flags:', error);
    }
  }

  private refreshCacheIfNeeded(): void {
    if (Date.now() - this.lastCacheUpdate > this.cacheExpiry) {
      this.loadFeatureFlags();
    }
  }

  public isEnabled(flagName: string, context?: EvaluationContext): boolean {
    const result = this.evaluate(flagName, context);
    return result.enabled;
  }

  public evaluate(flagName: string, context?: EvaluationContext): EvaluationResult {
    this.refreshCacheIfNeeded();

    // Check if flag exists in cache
    const flag = this.cache.get(flagName);
    if (!flag) {
      // Check config fallback
      const configValue = this.getConfigFallback(flagName);
      if (configValue !== undefined) {
        return {
          enabled: configValue,
          reason: 'config_fallback'
        };
      }

      return {
        enabled: false,
        reason: 'flag_not_found'
      };
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return {
        enabled: false,
        reason: 'globally_disabled'
      };
    }

    // Check date range
    const now = new Date();
    if (flag.startDate && new Date(flag.startDate) > now) {
      return {
        enabled: false,
        reason: 'not_started',
        metadata: { startDate: flag.startDate }
      };
    }

    if (flag.endDate && new Date(flag.endDate) < now) {
      return {
        enabled: false,
        reason: 'expired',
        metadata: { endDate: flag.endDate }
      };
    }

    // Check target users
    if (flag.targetUsers && flag.targetUsers.length > 0 && context?.userId) {
      if (flag.targetUsers.includes(context.userId)) {
        return {
          enabled: true,
          reason: 'target_user_match'
        };
      }
      // If target users are specified but user doesn't match, check other criteria
    }

    // Check target roles
    if (flag.targetRoles && flag.targetRoles.length > 0 && context?.userRole) {
      if (flag.targetRoles.includes(context.userRole)) {
        return {
          enabled: true,
          reason: 'target_role_match'
        };
      }
      // If target roles are specified but role doesn't match, check other criteria
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hashString(flagName + (context?.userId || context?.employeeId || 'anonymous'));
      const percentage = hash % 100;

      if (percentage < flag.rolloutPercentage) {
        return {
          enabled: true,
          reason: 'rollout_percentage',
          metadata: { percentage: flag.rolloutPercentage, userHash: percentage }
        };
      } else {
        return {
          enabled: false,
          reason: 'rollout_percentage_excluded',
          metadata: { percentage: flag.rolloutPercentage, userHash: percentage }
        };
      }
    }

    // Default to enabled if all checks pass
    return {
      enabled: true,
      reason: 'enabled'
    };
  }

  private getConfigFallback(flagName: string): boolean | undefined {
    // Map flag names to config values
    const flagMappings: Record<string, keyof FeatureFlags> = {
      'route_tracking': 'routeTracking',
      'live_tracking': 'liveTracking',
      'route_analytics': 'routeAnalytics',
      'route_visualization': 'routeVisualization',
      'route_optimization': 'routeOptimization',
      'mobile_optimization': 'mobileOptimization',
      'advanced_analytics': 'advancedAnalytics',
      'data_export': 'dataExport',
      'audit_logs': 'auditLogs',
      'privacy_controls': 'privacyControls',
      'database_optimization': 'databaseOptimization',
      'performance_monitoring': 'performanceMonitoring'
    };

    const configKey = flagMappings[flagName];
    if (configKey) {
      return config.featureFlags[configKey];
    }

    return undefined;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  public createFlag(flag: Omit<FeatureFlagConfig, 'name'> & { name: string }, updatedBy?: string): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO feature_flags 
        (name, enabled, description, rollout_percentage, target_users, target_roles, 
         start_date, end_date, metadata, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `);

      stmt.run(
        flag.name,
        flag.enabled ? 1 : 0,
        flag.description || null,
        flag.rolloutPercentage || 0,
        flag.targetUsers ? JSON.stringify(flag.targetUsers) : null,
        flag.targetRoles ? JSON.stringify(flag.targetRoles) : null,
        flag.startDate || null,
        flag.endDate || null,
        flag.metadata ? JSON.stringify(flag.metadata) : null,
        updatedBy || null
      );

      // Update cache
      this.cache.set(flag.name, flag);

      // Notify listeners
      this.notifyListeners(flag.name, flag.enabled);

      console.log(`✓ Feature flag '${flag.name}' ${flag.enabled ? 'enabled' : 'disabled'}`);
      return true;
    } catch (error) {
      console.error(`Failed to create feature flag '${flag.name}':`, error);
      return false;
    }
  }

  public updateFlag(name: string, updates: Partial<FeatureFlagConfig>, updatedBy?: string): boolean {
    try {
      const current = this.cache.get(name);
      if (!current) {
        return false;
      }

      const updated = { ...current, ...updates };

      const stmt = this.db.prepare(`
        UPDATE feature_flags SET
          enabled = ?,
          description = ?,
          rollout_percentage = ?,
          target_users = ?,
          target_roles = ?,
          start_date = ?,
          end_date = ?,
          metadata = ?,
          updated_at = datetime('now'),
          updated_by = ?
        WHERE name = ?
      `);

      stmt.run(
        updated.enabled ? 1 : 0,
        updated.description || null,
        updated.rolloutPercentage || 0,
        updated.targetUsers ? JSON.stringify(updated.targetUsers) : null,
        updated.targetRoles ? JSON.stringify(updated.targetRoles) : null,
        updated.startDate || null,
        updated.endDate || null,
        updated.metadata ? JSON.stringify(updated.metadata) : null,
        updatedBy || null,
        name
      );

      // Update cache
      this.cache.set(name, updated);

      // Notify listeners if enabled status changed
      if (current.enabled !== updated.enabled) {
        this.notifyListeners(name, updated.enabled);
      }

      console.log(`✓ Feature flag '${name}' updated`);
      return true;
    } catch (error) {
      console.error(`Failed to update feature flag '${name}':`, error);
      return false;
    }
  }

  public deleteFlag(name: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM feature_flags WHERE name = ?');
      const result = stmt.run(name);

      if (result.changes > 0) {
        this.cache.delete(name);
        console.log(`✓ Feature flag '${name}' deleted`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete feature flag '${name}':`, error);
      return false;
    }
  }

  public getAllFlags(): FeatureFlagConfig[] {
    this.refreshCacheIfNeeded();
    return Array.from(this.cache.values());
  }

  public getFlag(name: string): FeatureFlagConfig | undefined {
    this.refreshCacheIfNeeded();
    return this.cache.get(name);
  }

  public toggleFlag(name: string, updatedBy?: string): boolean {
    const flag = this.cache.get(name);
    if (!flag) {
      return false;
    }

    return this.updateFlag(name, { enabled: !flag.enabled }, updatedBy);
  }

  public setRolloutPercentage(name: string, percentage: number, updatedBy?: string): boolean {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    return this.updateFlag(name, { rolloutPercentage: percentage }, updatedBy);
  }

  public addTargetUser(name: string, userId: string, updatedBy?: string): boolean {
    const flag = this.cache.get(name);
    if (!flag) {
      return false;
    }

    const targetUsers = flag.targetUsers || [];
    if (!targetUsers.includes(userId)) {
      targetUsers.push(userId);
      return this.updateFlag(name, { targetUsers }, updatedBy);
    }
    return true;
  }

  public removeTargetUser(name: string, userId: string, updatedBy?: string): boolean {
    const flag = this.cache.get(name);
    if (!flag || !flag.targetUsers) {
      return false;
    }

    const targetUsers = flag.targetUsers.filter(id => id !== userId);
    return this.updateFlag(name, { targetUsers }, updatedBy);
  }

  public addTargetRole(name: string, role: string, updatedBy?: string): boolean {
    const flag = this.cache.get(name);
    if (!flag) {
      return false;
    }

    const targetRoles = flag.targetRoles || [];
    if (!targetRoles.includes(role)) {
      targetRoles.push(role);
      return this.updateFlag(name, { targetRoles }, updatedBy);
    }
    return true;
  }

  public removeTargetRole(name: string, role: string, updatedBy?: string): boolean {
    const flag = this.cache.get(name);
    if (!flag || !flag.targetRoles) {
      return false;
    }

    const targetRoles = flag.targetRoles.filter(r => r !== role);
    return this.updateFlag(name, { targetRoles }, updatedBy);
  }

  public subscribe(flagName: string, callback: (enabled: boolean) => void): () => void {
    if (!this.listeners.has(flagName)) {
      this.listeners.set(flagName, []);
    }

    this.listeners.get(flagName)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(flagName);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private notifyListeners(flagName: string, enabled: boolean): void {
    const callbacks = this.listeners.get(flagName);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(enabled);
        } catch (error) {
          console.error(`Feature flag listener error for '${flagName}':`, error);
        }
      });
    }
  }

  public getEvaluationStats(flagName: string, days: number = 7): {
    totalEvaluations: number;
    enabledCount: number;
    disabledCount: number;
    reasons: Record<string, number>;
  } {
    // This would require tracking evaluations in the database
    // For now, return empty stats
    return {
      totalEvaluations: 0,
      enabledCount: 0,
      disabledCount: 0,
      reasons: {}
    };
  }

  public exportFlags(): string {
    const flags = this.getAllFlags();
    return JSON.stringify(flags, null, 2);
  }

  public importFlags(flagsJson: string, updatedBy?: string): { success: number; failed: number; errors: string[] } {
    const result = { success: 0, failed: 0, errors: [] as string[] };

    try {
      const flags = JSON.parse(flagsJson) as FeatureFlagConfig[];

      for (const flag of flags) {
        if (this.createFlag(flag, updatedBy)) {
          result.success++;
        } else {
          result.failed++;
          result.errors.push(`Failed to import flag: ${flag.name}`);
        }
      }
    } catch (error) {
      result.errors.push(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }
}

export default FeatureFlagService;
export type { FeatureFlagConfig, EvaluationContext, EvaluationResult };