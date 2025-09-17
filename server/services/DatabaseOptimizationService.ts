import Database from 'better-sqlite3';

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  partial: boolean;
}

export interface QueryPlan {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

export interface OptimizationRecommendation {
  type: 'index' | 'query' | 'schema' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  table: string;
  description: string;
  sql?: string;
  estimatedImprovement: string;
}

export class DatabaseOptimizationService {
  private db: Database.Database;
  private queryStats: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();

  constructor(database: Database.Database) {
    this.db = database;
    this.setupQueryLogging();
  }

  /**
   * Setup query performance logging
   */
  private setupQueryLogging(): void {
    // Enable query logging in development
    if (process.env.NODE_ENV === 'development') {
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');
    }
  }

  /**
   * Analyze route tracking table performance
   */
  analyzeRouteTrackingPerformance(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // Check if route_tracking table exists
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='route_tracking'
      `).get();

      if (!tableExists) {
        return recommendations;
      }

      // Get table info
      const tableInfo = this.db.pragma('table_info(route_tracking)');
      const indexes = this.db.pragma('index_list(route_tracking)');

      // Check for missing indexes
      const missingIndexes = this.checkMissingIndexes();
      recommendations.push(...missingIndexes);

      // Check for unused indexes
      const unusedIndexes = this.checkUnusedIndexes();
      recommendations.push(...unusedIndexes);

      // Check query patterns
      const queryOptimizations = this.analyzeQueryPatterns();
      recommendations.push(...queryOptimizations);

      // Check table statistics
      const maintenanceRecommendations = this.checkMaintenanceNeeds();
      recommendations.push(...maintenanceRecommendations);

    } catch (error) {
      console.error('Error analyzing route tracking performance:', error);
    }

    return recommendations;
  }

  /**
   * Check for missing indexes that could improve performance
   */
  private checkMissingIndexes(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check if essential indexes exist
    const essentialIndexes = [
      {
        name: 'idx_route_tracking_employee_date',
        columns: ['employee_id', 'date'],
        reason: 'Frequently queried together for analytics'
      },
      {
        name: 'idx_route_tracking_session',
        columns: ['session_id'],
        reason: 'Primary lookup field for session data'
      },
      {
        name: 'idx_route_tracking_timestamp',
        columns: ['timestamp'],
        reason: 'Used for time-based queries and sorting'
      },
      {
        name: 'idx_route_tracking_shipment',
        columns: ['shipment_id'],
        reason: 'Links route data to shipments'
      },
      {
        name: 'idx_route_tracking_status',
        columns: ['session_status'],
        reason: 'Filters active/completed sessions'
      },
      {
        name: 'idx_route_tracking_event_type',
        columns: ['event_type'],
        reason: 'Separates GPS tracking from shipment events'
      }
    ];

    for (const index of essentialIndexes) {
      const exists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name=?
      `).get(index.name);

      if (!exists) {
        recommendations.push({
          type: 'index',
          priority: 'high',
          table: 'route_tracking',
          description: `Missing index on ${index.columns.join(', ')} - ${index.reason}`,
          sql: `CREATE INDEX ${index.name} ON route_tracking(${index.columns.join(', ')});`,
          estimatedImprovement: '50-80% faster queries'
        });
      }
    }

    // Check for composite indexes based on common query patterns
    const compositeIndexes = [
      {
        name: 'idx_route_tracking_employee_status_date',
        columns: ['employee_id', 'session_status', 'date'],
        reason: 'Analytics queries filtering by employee and status'
      },
      {
        name: 'idx_route_tracking_date_event_type',
        columns: ['date', 'event_type'],
        reason: 'Daily reports separating GPS from shipment events'
      }
    ];

    for (const index of compositeIndexes) {
      const exists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name=?
      `).get(index.name);

      if (!exists) {
        recommendations.push({
          type: 'index',
          priority: 'medium',
          table: 'route_tracking',
          description: `Composite index on ${index.columns.join(', ')} - ${index.reason}`,
          sql: `CREATE INDEX ${index.name} ON route_tracking(${index.columns.join(', ')});`,
          estimatedImprovement: '30-50% faster complex queries'
        });
      }
    }

    return recommendations;
  }

  /**
   * Check for unused indexes
   */
  private checkUnusedIndexes(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // Get all indexes for route_tracking table
      const indexes = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND tbl_name='route_tracking'
        AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];

      // In a real implementation, we would track index usage
      // For now, we'll check for potentially redundant indexes
      const indexNames = indexes.map(i => i.name);

      // Check for redundant indexes (simplified logic)
      const redundantPatterns = [
        { pattern: /^idx_.*_id$/, reason: 'Single column ID indexes may be redundant' },
        { pattern: /^idx_.*_temp/, reason: 'Temporary indexes should be cleaned up' }
      ];

      for (const index of indexes) {
        for (const pattern of redundantPatterns) {
          if (pattern.pattern.test(index.name)) {
            recommendations.push({
              type: 'index',
              priority: 'low',
              table: 'route_tracking',
              description: `Potentially unused index: ${index.name} - ${pattern.reason}`,
              sql: `DROP INDEX IF EXISTS ${index.name};`,
              estimatedImprovement: 'Reduced storage and faster writes'
            });
          }
        }
      }

    } catch (error) {
      console.error('Error checking unused indexes:', error);
    }

    return recommendations;
  }

  /**
   * Analyze query patterns for optimization opportunities
   */
  private analyzeQueryPatterns(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check for common slow query patterns
    const slowQueryPatterns = [
      {
        pattern: 'SELECT * FROM route_tracking',
        issue: 'Full table scans without WHERE clause',
        solution: 'Add appropriate WHERE clauses and LIMIT'
      },
      {
        pattern: 'ORDER BY timestamp',
        issue: 'Sorting large result sets',
        solution: 'Use index on timestamp column'
      },
      {
        pattern: 'GROUP BY employee_id',
        issue: 'Grouping without proper indexes',
        solution: 'Ensure index on employee_id exists'
      }
    ];

    // In a real implementation, we would analyze actual query logs
    // For now, provide general recommendations
    recommendations.push({
      type: 'query',
      priority: 'medium',
      table: 'route_tracking',
      description: 'Use LIMIT clauses for large result sets to improve response time',
      estimatedImprovement: '20-40% faster queries'
    });

    recommendations.push({
      type: 'query',
      priority: 'medium',
      table: 'route_tracking',
      description: 'Use specific column names instead of SELECT * to reduce data transfer',
      estimatedImprovement: '10-30% faster queries'
    });

    return recommendations;
  }

  /**
   * Check maintenance needs
   */
  private checkMaintenanceNeeds(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // Check table size and fragmentation
      const tableInfo = this.db.prepare(`
        SELECT 
          COUNT(*) as row_count,
          MAX(rowid) as max_rowid
        FROM route_tracking
      `).get() as { row_count: number; max_rowid: number };

      if (tableInfo && tableInfo.row_count > 10000) {
        // Check for fragmentation (simplified)
        const fragmentation = tableInfo.max_rowid / tableInfo.row_count;

        if (fragmentation > 1.5) {
          recommendations.push({
            type: 'maintenance',
            priority: 'medium',
            table: 'route_tracking',
            description: `Table fragmentation detected (${fragmentation.toFixed(2)}x) - consider VACUUM`,
            sql: 'VACUUM;',
            estimatedImprovement: '10-20% better performance'
          });
        }

        // Recommend archiving old data
        if (tableInfo.row_count > 100000) {
          recommendations.push({
            type: 'maintenance',
            priority: 'high',
            table: 'route_tracking',
            description: `Large table (${tableInfo.row_count.toLocaleString()} rows) - consider archiving old data`,
            estimatedImprovement: '30-50% faster queries'
          });
        }
      }

      // Check for analyze statistics
      recommendations.push({
        type: 'maintenance',
        priority: 'low',
        table: 'route_tracking',
        description: 'Run ANALYZE to update query planner statistics',
        sql: 'ANALYZE route_tracking;',
        estimatedImprovement: '5-15% better query plans'
      });

    } catch (error) {
      console.error('Error checking maintenance needs:', error);
    }

    return recommendations;
  }

  /**
   * Apply optimization recommendations
   */
  async applyOptimizations(recommendations: OptimizationRecommendation[]): Promise<{
    applied: number;
    failed: number;
    errors: string[];
  }> {
    let applied = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const rec of recommendations) {
      if (!rec.sql) continue;

      try {
        this.db.exec(rec.sql);
        applied++;
        console.log(`Applied optimization: ${rec.description}`);
      } catch (error) {
        failed++;
        const errorMsg = `Failed to apply ${rec.description}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return { applied, failed, errors };
  }

  /**
   * Get database statistics
   */
  getDatabaseStats(): {
    tableCount: number;
    indexCount: number;
    totalSize: number;
    routeTrackingStats?: {
      rowCount: number;
      indexCount: number;
      avgRowSize: number;
    };
  } {
    try {
      // Get overall database stats
      const tables = this.db.prepare(`
        SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'
      `).get() as { count: number };

      const indexes = this.db.prepare(`
        SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'
      `).get() as { count: number };

      // Get database size (simplified - would need file system access for actual size)
      const pageCount = this.db.pragma('page_count', { simple: true }) as number;
      const pageSize = this.db.pragma('page_size', { simple: true }) as number;
      const totalSize = pageCount * pageSize;

      // Get route_tracking specific stats
      let routeTrackingStats;
      try {
        const routeStats = this.db.prepare(`
          SELECT COUNT(*) as row_count FROM route_tracking
        `).get() as { row_count: number };

        const routeIndexes = this.db.prepare(`
          SELECT COUNT(*) as count FROM sqlite_master 
          WHERE type='index' AND tbl_name='route_tracking'
        `).get() as { count: number };

        routeTrackingStats = {
          rowCount: routeStats.row_count,
          indexCount: routeIndexes.count,
          avgRowSize: totalSize > 0 ? Math.round(totalSize / routeStats.row_count) : 0
        };
      } catch (error) {
        // route_tracking table might not exist yet
      }

      return {
        tableCount: tables.count,
        indexCount: indexes.count,
        totalSize,
        routeTrackingStats
      };

    } catch (error) {
      console.error('Error getting database stats:', error);
      return {
        tableCount: 0,
        indexCount: 0,
        totalSize: 0
      };
    }
  }

  /**
   * Explain query plan for analysis
   */
  explainQuery(sql: string): QueryPlan[] {
    try {
      const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as QueryPlan[];
      return plan;
    } catch (error) {
      console.error('Error explaining query:', error);
      return [];
    }
  }

  /**
   * Record query performance
   */
  recordQueryPerformance(queryType: string, executionTime: number): void {
    const stats = this.queryStats.get(queryType) || { count: 0, totalTime: 0, avgTime: 0 };

    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;

    this.queryStats.set(queryType, stats);
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): Map<string, { count: number; totalTime: number; avgTime: number }> {
    return new Map(this.queryStats);
  }

  /**
   * Optimize database configuration
   */
  optimizeConfiguration(): void {
    try {
      // Set optimal SQLite pragmas for route tracking workload
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 2000'); // 2MB cache
      this.db.pragma('temp_store = memory');
      this.db.pragma('mmap_size = 268435456'); // 256MB memory map
      this.db.pragma('optimize');

      console.log('Database configuration optimized for route tracking');
    } catch (error) {
      console.error('Error optimizing database configuration:', error);
    }
  }

  /**
   * Create essential indexes if they don't exist
   */
  createEssentialIndexes(): void {
    const essentialIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_route_tracking_employee_date ON route_tracking(employee_id, date)',
      'CREATE INDEX IF NOT EXISTS idx_route_tracking_session ON route_tracking(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_route_tracking_timestamp ON route_tracking(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_route_tracking_shipment ON route_tracking(shipment_id)',
      'CREATE INDEX IF NOT EXISTS idx_route_tracking_status ON route_tracking(session_status)',
      'CREATE INDEX IF NOT EXISTS idx_route_tracking_event_type ON route_tracking(event_type)'
    ];

    for (const indexSql of essentialIndexes) {
      try {
        this.db.exec(indexSql);
      } catch (error) {
        console.error('Error creating index:', error);
      }
    }

    console.log('Essential indexes created/verified');
  }

  /**
   * Clean up old data based on retention policy
   */
  cleanupOldData(retentionDays: number = 90): number {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffIso = cutoffDate.toISOString().split('T')[0];

      const result = this.db.prepare(`
        DELETE FROM route_tracking 
        WHERE date < ? AND session_status = 'completed'
      `).run(cutoffIso);

      console.log(`Cleaned up ${result.changes} old route tracking records`);
      return result.changes;
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      return 0;
    }
  }
}