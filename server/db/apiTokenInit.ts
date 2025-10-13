import Database from 'better-sqlite3';
import { primaryDb } from './connection.js';

export interface DatabaseInitResult {
  success: boolean;
  tablesCreated: string[];
  indexesCreated: string[];
  errors: string[];
  initializationTime: number;
}

export class ApiTokenDatabaseInitializer {
  private db: Database.Database;
  private initialized = false;
  private initializationPromise: Promise<DatabaseInitResult> | null = null;

  constructor(database: Database.Database = primaryDb) {
    this.db = database;
  }

  /**
   * Initialize API token database tables with comprehensive error handling
   * This method is idempotent and can be called multiple times safely
   */
  async initializeDatabase(): Promise<DatabaseInitResult> {
    // If already initializing, return the existing promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // If already initialized, return success immediately
    if (this.initialized) {
      return {
        success: true,
        tablesCreated: [],
        indexesCreated: [],
        errors: [],
        initializationTime: 0
      };
    }

    // Start initialization
    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<DatabaseInitResult> {
    const startTime = Date.now();
    const result: DatabaseInitResult = {
      success: false,
      tablesCreated: [],
      indexesCreated: [],
      errors: [],
      initializationTime: 0
    };

    try {
      console.log('🔧 Starting API token database initialization...');

      // Check if database is accessible
      await this.checkDatabaseConnection();

      // Create tables
      await this.createApiTokensTable(result);
      await this.createTokenUsageLogsTable(result);

      // Create indexes
      await this.createIndexes(result);

      // Verify table creation
      await this.verifyTables(result);

      this.initialized = true;
      result.success = result.errors.length === 0;
      result.initializationTime = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ API token database initialized successfully in ${result.initializationTime}ms`);
        console.log(`   Tables created: ${result.tablesCreated.join(', ')}`);
        console.log(`   Indexes created: ${result.indexesCreated.join(', ')}`);
      } else {
        console.error('❌ API token database initialization completed with errors:');
        result.errors.forEach(error => console.error(`   - ${error}`));
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Critical initialization error: ${errorMessage}`);
      result.success = false;
      result.initializationTime = Date.now() - startTime;

      console.error('❌ Critical error during API token database initialization:', error);
    }

    return result;
  }

  private async checkDatabaseConnection(): Promise<void> {
    try {
      // Test database connection with a simple query
      this.db.prepare('SELECT 1').get();
      console.log('✓ Database connection verified');
    } catch (error) {
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createApiTokensTable(result: DatabaseInitResult): Promise<void> {
    try {
      const tableName = 'api_tokens';

      // Check if table already exists
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(tableName);

      if (tableExists) {
        console.log(`✓ Table '${tableName}' already exists`);
        return;
      }

      this.db.exec(`
        CREATE TABLE api_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          token_hash TEXT NOT NULL UNIQUE,
          token_prefix TEXT NOT NULL,
          permissions TEXT NOT NULL CHECK(permissions IN ('read', 'write', 'admin')),
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled', 'revoked')),
          expires_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT NOT NULL,
          last_used_at DATETIME,
          last_used_ip TEXT,
          request_count INTEGER DEFAULT 0
        )
      `);

      result.tablesCreated.push(tableName);
      console.log(`✓ Created table '${tableName}'`);
    } catch (error) {
      const errorMessage = `Failed to create api_tokens table: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
      console.error(`❌ ${errorMessage}`);
    }
  }

  private async createTokenUsageLogsTable(result: DatabaseInitResult): Promise<void> {
    try {
      const tableName = 'token_usage_logs';

      // Check if table already exists
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(tableName);

      if (tableExists) {
        console.log(`✓ Table '${tableName}' already exists`);
        return;
      }

      this.db.exec(`
        CREATE TABLE token_usage_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_id INTEGER NOT NULL,
          endpoint TEXT NOT NULL,
          method TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          status_code INTEGER,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (token_id) REFERENCES api_tokens (id) ON DELETE CASCADE
        )
      `);

      result.tablesCreated.push(tableName);
      console.log(`✓ Created table '${tableName}'`);
    } catch (error) {
      const errorMessage = `Failed to create token_usage_logs table: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
      console.error(`❌ ${errorMessage}`);
    }
  }

  private async createIndexes(result: DatabaseInitResult): Promise<void> {
    const indexes = [
      {
        name: 'idx_api_tokens_hash',
        sql: 'CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash)'
      },
      {
        name: 'idx_api_tokens_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_api_tokens_status ON api_tokens(status)'
      },
      {
        name: 'idx_api_tokens_expires',
        sql: 'CREATE INDEX IF NOT EXISTS idx_api_tokens_expires ON api_tokens(expires_at)'
      },
      {
        name: 'idx_api_tokens_created_by',
        sql: 'CREATE INDEX IF NOT EXISTS idx_api_tokens_created_by ON api_tokens(created_by)'
      },
      {
        name: 'idx_token_usage_logs_token_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_token_usage_logs_token_id ON token_usage_logs(token_id)'
      },
      {
        name: 'idx_token_usage_logs_created_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_token_usage_logs_created_at ON token_usage_logs(created_at)'
      },
      {
        name: 'idx_token_usage_logs_endpoint',
        sql: 'CREATE INDEX IF NOT EXISTS idx_token_usage_logs_endpoint ON token_usage_logs(endpoint)'
      }
    ];

    for (const index of indexes) {
      try {
        this.db.exec(index.sql);
        result.indexesCreated.push(index.name);
        console.log(`✓ Created index '${index.name}'`);
      } catch (error) {
        const errorMessage = `Failed to create index '${index.name}': ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMessage);
        console.error(`❌ ${errorMessage}`);
      }
    }
  }

  private async verifyTables(result: DatabaseInitResult): Promise<void> {
    const requiredTables = ['api_tokens', 'token_usage_logs'];

    for (const tableName of requiredTables) {
      try {
        const tableInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all();

        if (tableInfo.length === 0) {
          result.errors.push(`Table '${tableName}' was not created successfully`);
        } else {
          console.log(`✓ Verified table '${tableName}' (${tableInfo.length} columns)`);
        }
      } catch (error) {
        const errorMessage = `Failed to verify table '${tableName}': ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMessage);
        console.error(`❌ ${errorMessage}`);
      }
    }
  }

  /**
   * Check if the database is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Force re-initialization (useful for testing or recovery)
   */
  async forceReinitialize(): Promise<DatabaseInitResult> {
    this.initialized = false;
    this.initializationPromise = null;
    return this.initializeDatabase();
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<{
    connected: boolean;
    tablesExist: boolean;
    indexesExist: boolean;
    errors: string[];
  }> {
    const status = {
      connected: false,
      tablesExist: false,
      indexesExist: false,
      errors: [] as string[]
    };

    try {
      // Check connection
      this.db.prepare('SELECT 1').get();
      status.connected = true;

      // Check tables
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('api_tokens', 'token_usage_logs')
      `).all() as { name: string }[];

      status.tablesExist = tables.length === 2;

      // Check indexes
      const indexes = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_api_tokens_%' OR name LIKE 'idx_token_usage_logs_%'
      `).all() as { name: string }[];

      status.indexesExist = indexes.length >= 6; // We create 7 indexes

    } catch (error) {
      status.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return status;
  }

  /**
   * Clean up expired tokens and old logs
   */
  async performMaintenance(): Promise<{
    expiredTokensRevoked: number;
    oldLogsDeleted: number;
    errors: string[];
  }> {
    const result = {
      expiredTokensRevoked: 0,
      oldLogsDeleted: 0,
      errors: [] as string[]
    };

    try {
      // Ensure database is initialized
      await this.initializeDatabase();

      // Revoke expired tokens
      const expiredStmt = this.db.prepare(`
        UPDATE api_tokens 
        SET status = 'revoked' 
        WHERE expires_at < datetime('now') 
          AND status IN ('active', 'disabled')
      `);
      const expiredResult = expiredStmt.run();
      result.expiredTokensRevoked = expiredResult.changes;

      // Delete old usage logs (older than 90 days)
      const oldLogsStmt = this.db.prepare(`
        DELETE FROM token_usage_logs 
        WHERE created_at < datetime('now', '-90 days')
      `);
      const oldLogsResult = oldLogsStmt.run();
      result.oldLogsDeleted = oldLogsResult.changes;

      console.log(`🧹 Database maintenance completed: ${result.expiredTokensRevoked} expired tokens revoked, ${result.oldLogsDeleted} old logs deleted`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Maintenance error: ${errorMessage}`);
      console.error('❌ Database maintenance error:', error);
    }

    return result;
  }
}

// Export singleton instance
export const apiTokenDbInitializer = new ApiTokenDatabaseInitializer();

// Export convenience function for easy access
export const initializeApiTokenDatabase = () => apiTokenDbInitializer.initializeDatabase();