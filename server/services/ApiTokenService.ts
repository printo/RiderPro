import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { primaryDb } from '../db/connection.js';
import { apiTokenDbInitializer } from '../db/apiTokenInit.js';
import { apiTokenErrorHandler, ApiTokenErrorCode } from '../utils/apiTokenErrorHandler.js';

export interface CreateTokenRequest {
  name: string;
  description?: string;
  permissions: 'read' | 'write' | 'admin';
  expiresAt?: Date;
  createdBy: string;
}

export interface ApiToken {
  id: number;
  name: string;
  description?: string;
  tokenPrefix: string; // First 8 characters for display
  permissions: string;
  status: 'active' | 'disabled' | 'revoked';
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string;
  lastUsedAt?: Date;
  lastUsedIp?: string;
  requestCount: number;
}

export interface TokenUsageLog {
  id: number;
  tokenId: number;
  endpoint: string;
  method: string;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
  createdAt: Date;
}

export interface TokenUsageStats {
  totalRequests: number;
  recentActivity: TokenUsageLog[];
  dailyUsage: { date: string; count: number }[];
  topEndpoints: { endpoint: string; count: number }[];
}

export interface UsageAnalytics {
  totalTokens: number;
  activeTokens: number;
  totalRequests: number;
  requestsToday: number;
  requestsThisWeek: number;
  requestsThisMonth: number;
  topTokens: { tokenId: number; name: string; requestCount: number }[];
  topEndpoints: { endpoint: string; count: number }[];
  dailyUsage: { date: string; count: number }[];
  weeklyUsage: { week: string; count: number }[];
  methodDistribution: { method: string; count: number }[];
  statusCodeDistribution: { statusCode: number; count: number }[];
}

export interface ExportData {
  tokens: ApiToken[];
  usageLogs: TokenUsageLog[];
  analytics: UsageAnalytics;
  exportedAt: Date;
}

export interface RequestInfo {
  endpoint: string;
  method: string;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
}

export class ApiTokenService {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  /**
   * Initialize database tables for API tokens
   * This is called on-demand when admin accesses token management
   */
  async initializeTables(): Promise<void> {
    try {
      const result = await apiTokenDbInitializer.initializeDatabase();

      if (!result.success) {
        const errorMessage = `Database initialization failed: ${result.errors.join(', ')}`;
        console.error('❌ API Token Service initialization failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log(`✅ API Token Service initialized successfully in ${result.initializationTime}ms`);
    } catch (error) {
      console.error('❌ Critical error in API Token Service initialization:', error);
      throw new Error(`Failed to initialize API token database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a secure random token with enhanced security
   * Uses crypto.randomBytes for cryptographically secure random generation
   * Returns a 64-character hex string (256 bits of entropy)
   */
  private generateSecureToken(): string {
    // Generate 32 bytes (256 bits) of cryptographically secure random data
    const randomBytes = crypto.randomBytes(32);

    // Convert to hex string (64 characters)
    const token = randomBytes.toString('hex');

    // Validate token generation
    if (token.length !== 64) {
      throw new Error('Token generation failed: Invalid token length');
    }

    // Ensure token contains only valid hex characters
    if (!/^[a-f0-9]{64}$/.test(token)) {
      throw new Error('Token generation failed: Invalid token format');
    }

    return token;
  }

  /**
   * Hash a token using bcrypt with enhanced security
   * Uses 12 salt rounds for strong security while maintaining performance
   */
  private async hashToken(token: string): Promise<string> {
    // Validate input token
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token provided for hashing');
    }

    if (token.length !== 64) {
      throw new Error('Token must be 64 characters long');
    }

    // Use 12 salt rounds for strong security (2^12 = 4096 iterations)
    // This provides good security while maintaining reasonable performance
    const saltRounds = 12;

    try {
      const hash = await bcrypt.hash(token, saltRounds);

      // Validate hash generation
      if (!hash || hash.length < 50) {
        throw new Error('Hash generation failed');
      }

      return hash;
    } catch (error) {
      console.error('Token hashing failed:', error);
      throw new Error('Failed to hash token securely');
    }
  }

  /**
   * Validate a token hash with enhanced security checks
   */
  private async validateTokenHash(token: string, hash: string): Promise<boolean> {
    // Validate inputs
    if (!token || !hash || typeof token !== 'string' || typeof hash !== 'string') {
      return false;
    }

    // Validate token format (64 hex characters)
    if (token.length !== 64 || !/^[a-f0-9]{64}$/.test(token)) {
      return false;
    }

    // Validate hash format (bcrypt hashes start with $2a$, $2b$, or $2y$)
    if (!hash.startsWith('$2') || hash.length < 50) {
      return false;
    }

    try {
      return await bcrypt.compare(token, hash);
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Extract token prefix for display purposes
   * Returns first 8 characters for safe display in UI
   */
  private extractTokenPrefix(token: string): string {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token provided for prefix extraction');
    }

    if (token.length < 8) {
      throw new Error('Token too short for prefix extraction');
    }

    // Extract first 8 characters for display
    const prefix = token.substring(0, 8);

    // Validate prefix format (should be hex)
    if (!/^[a-f0-9]{8}$/.test(prefix)) {
      throw new Error('Invalid token format for prefix extraction');
    }

    return prefix;
  }

  /**
   * Create a new API token
   */
  async createToken(data: CreateTokenRequest, requestId?: string): Promise<{ token: string; tokenData: ApiToken }> {
    try {
      await this.initializeTables();

      const token = this.generateSecureToken();
      const tokenHash = await this.hashToken(token);
      const tokenPrefix = this.extractTokenPrefix(token);

      const stmt = this.db.prepare(`
        INSERT INTO api_tokens (
          name, description, token_hash, token_prefix, permissions, 
          expires_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.name,
        data.description || null,
        tokenHash,
        tokenPrefix,
        data.permissions,
        data.expiresAt ? data.expiresAt.toISOString() : null,
        data.createdBy
      );

      const tokenData: ApiToken = {
        id: result.lastInsertRowid as number,
        name: data.name,
        description: data.description,
        tokenPrefix,
        permissions: data.permissions,
        status: 'active',
        expiresAt: data.expiresAt,
        createdAt: new Date(),
        createdBy: data.createdBy,
        requestCount: 0
      };

      console.log(`✅ API token created: ${data.name} (ID: ${tokenData.id})`);
      return { token, tokenData };
    } catch (error) {
      console.error('❌ Error creating API token:', error);

      if (error instanceof Error) {
        const apiError = apiTokenErrorHandler.handleDatabaseError(error, 'create_token', requestId);
        throw new Error(apiError.message);
      }

      const systemError = apiTokenErrorHandler.handleSystemError('token_creation', new Error('Unknown error'), requestId);
      throw new Error(systemError.message);
    }
  }

  /**
   * Get all API tokens
   */
  async getTokens(requestId?: string): Promise<ApiToken[]> {
    try {
      await this.initializeTables();

      const stmt = this.db.prepare(`
        SELECT 
          id, name, description, token_prefix, permissions, status,
          expires_at, created_at, created_by, last_used_at, last_used_ip, request_count
        FROM api_tokens
        ORDER BY created_at DESC
      `);

      const rows = stmt.all() as any[];

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        tokenPrefix: row.token_prefix,
        permissions: row.permissions,
        status: row.status,
        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
        createdAt: new Date(row.created_at),
        createdBy: row.created_by,
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
        lastUsedIp: row.last_used_ip,
        requestCount: row.request_count || 0
      }));
    } catch (error) {
      console.error('❌ Error fetching API tokens:', error);

      if (error instanceof Error) {
        const apiError = apiTokenErrorHandler.handleDatabaseError(error, 'get_tokens', requestId);
        throw new Error(apiError.message);
      }

      const systemError = apiTokenErrorHandler.handleSystemError('get_tokens', new Error('Unknown error'), requestId);
      throw new Error(systemError.message);
    }
  }

  /**
   * Validate a token and return token data if valid
   */
  async validateToken(token: string): Promise<ApiToken | null> {
    await this.initializeTables();

    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, name, description, token_hash, token_prefix, permissions, status,
          expires_at, created_at, created_by, last_used_at, last_used_ip, request_count
        FROM api_tokens
        WHERE status = 'active'
      `);

      const rows = stmt.all() as any[];

      // Check each active token hash
      for (const row of rows) {
        const isValid = await this.validateTokenHash(token, row.token_hash);
        if (isValid) {
          // Check if token is expired
          if (row.expires_at && new Date(row.expires_at) < new Date()) {
            console.log(`Token ${row.id} is expired`);
            return null;
          }

          return {
            id: row.id,
            name: row.name,
            description: row.description,
            tokenPrefix: row.token_prefix,
            permissions: row.permissions,
            status: row.status,
            expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
            createdAt: new Date(row.created_at),
            createdBy: row.created_by,
            lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
            lastUsedIp: row.last_used_ip,
            requestCount: row.request_count || 0
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error validating token:', error);
      return null;
    }
  }

  /**
   * Check if a token has permission for a specific HTTP method
   */
  async checkPermission(token: ApiToken, method: string): Promise<boolean> {
    const methodUpper = method.toUpperCase();

    switch (token.permissions) {
      case 'read':
        return methodUpper === 'GET';
      case 'write':
        return ['GET', 'POST', 'PATCH'].includes(methodUpper);
      case 'admin':
        return ['GET', 'POST', 'PATCH', 'DELETE'].includes(methodUpper);
      default:
        return false;
    }
  }

  /**
   * Revoke a token (permanent)
   */
  async revokeToken(id: number): Promise<boolean> {
    await this.initializeTables();

    try {
      const stmt = this.db.prepare(`
        UPDATE api_tokens 
        SET status = 'revoked' 
        WHERE id = ? AND status != 'revoked'
      `);

      const result = stmt.run(id);
      const success = result.changes > 0;

      if (success) {
        console.log(`API token revoked: ID ${id}`);
      }

      return success;
    } catch (error) {
      console.error('Error revoking token:', error);
      throw new Error('Failed to revoke token');
    }
  }

  /**
   * Toggle token status between active and disabled
   */
  async toggleTokenStatus(id: number, status: 'active' | 'disabled'): Promise<boolean> {
    await this.initializeTables();

    if (!['active', 'disabled'].includes(status)) {
      throw new Error('Invalid status. Must be "active" or "disabled"');
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE api_tokens 
        SET status = ? 
        WHERE id = ? AND status != 'revoked'
      `);

      const result = stmt.run(status, id);
      const success = result.changes > 0;

      if (success) {
        console.log(`API token status updated: ID ${id} -> ${status}`);
      }

      return success;
    } catch (error) {
      console.error('Error updating token status:', error);
      throw new Error('Failed to update token status');
    }
  }

  /**
   * Log token usage
   */
  async logTokenUsage(tokenId: number, request: RequestInfo): Promise<void> {
    await this.initializeTables();

    try {
      // Insert usage log
      const logStmt = this.db.prepare(`
        INSERT INTO token_usage_logs (
          token_id, endpoint, method, ip_address, user_agent, status_code
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      logStmt.run(
        tokenId,
        request.endpoint,
        request.method,
        request.ipAddress || null,
        request.userAgent || null,
        request.statusCode || null
      );

      // Update token last used info and request count
      const updateStmt = this.db.prepare(`
        UPDATE api_tokens 
        SET 
          last_used_at = CURRENT_TIMESTAMP,
          last_used_ip = ?,
          request_count = request_count + 1
        WHERE id = ?
      `);

      updateStmt.run(request.ipAddress || null, tokenId);
    } catch (error) {
      console.error('Error logging token usage:', error);
      // Don't throw error here to avoid breaking API requests
    }
  }

  /**
   * Get token usage statistics
   */
  async getTokenUsage(tokenId: number): Promise<TokenUsageStats> {
    await this.initializeTables();

    try {
      // Get total requests
      const totalStmt = this.db.prepare(`
        SELECT request_count FROM api_tokens WHERE id = ?
      `);
      const totalResult = totalStmt.get(tokenId) as { request_count: number } | undefined;
      const totalRequests = totalResult?.request_count || 0;

      // Get recent activity (last 50 requests)
      const recentStmt = this.db.prepare(`
        SELECT 
          id, token_id, endpoint, method, ip_address, user_agent, 
          status_code, created_at
        FROM token_usage_logs 
        WHERE token_id = ?
        ORDER BY created_at DESC 
        LIMIT 50
      `);
      const recentRows = recentStmt.all(tokenId) as any[];

      const recentActivity: TokenUsageLog[] = recentRows.map(row => ({
        id: row.id,
        tokenId: row.token_id,
        endpoint: row.endpoint,
        method: row.method,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        statusCode: row.status_code,
        createdAt: new Date(row.created_at)
      }));

      // Get daily usage for last 30 days
      const dailyStmt = this.db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM token_usage_logs 
        WHERE token_id = ? 
          AND created_at >= datetime('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
      const dailyRows = dailyStmt.all(tokenId) as { date: string; count: number }[];

      // Get top endpoints
      const endpointsStmt = this.db.prepare(`
        SELECT 
          endpoint,
          COUNT(*) as count
        FROM token_usage_logs 
        WHERE token_id = ?
        GROUP BY endpoint
        ORDER BY count DESC
        LIMIT 10
      `);
      const endpointRows = endpointsStmt.all(tokenId) as { endpoint: string; count: number }[];

      return {
        totalRequests,
        recentActivity,
        dailyUsage: dailyRows,
        topEndpoints: endpointRows
      };
    } catch (error) {
      console.error('Error fetching token usage stats:', error);
      return {
        totalRequests: 0,
        recentActivity: [],
        dailyUsage: [],
        topEndpoints: []
      };
    }
  }



  /**
   * Get token by ID
   */
  async getTokenById(id: number): Promise<ApiToken | null> {
    await this.initializeTables();

    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, name, description, token_prefix, permissions, status,
          expires_at, created_at, created_by, last_used_at, last_used_ip, request_count
        FROM api_tokens
        WHERE id = ?
      `);

      const row = stmt.get(id) as any;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        tokenPrefix: row.token_prefix,
        permissions: row.permissions,
        status: row.status,
        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
        createdAt: new Date(row.created_at),
        createdBy: row.created_by,
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
        lastUsedIp: row.last_used_ip,
        requestCount: row.request_count || 0
      };
    } catch (error) {
      console.error('Error fetching token by ID:', error);
      return null;
    }
  }

  /**
   * Get comprehensive usage analytics for all tokens
   */
  async getUsageAnalytics(): Promise<UsageAnalytics> {
    await this.initializeTables();

    try {
      // Get token counts
      const tokenCountsStmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active
        FROM api_tokens
      `);
      const tokenCounts = tokenCountsStmt.get() as { total: number; active: number };

      // Get total requests
      const totalRequestsStmt = this.db.prepare(`
        SELECT COALESCE(SUM(request_count), 0) as total FROM api_tokens
      `);
      const totalRequestsResult = totalRequestsStmt.get() as { total: number };

      // Get requests today
      const requestsTodayStmt = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM token_usage_logs 
        WHERE DATE(created_at) = DATE('now')
      `);
      const requestsTodayResult = requestsTodayStmt.get() as { count: number };

      // Get requests this week
      const requestsWeekStmt = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM token_usage_logs 
        WHERE created_at >= datetime('now', '-7 days')
      `);
      const requestsWeekResult = requestsWeekStmt.get() as { count: number };

      // Get requests this month
      const requestsMonthStmt = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM token_usage_logs 
        WHERE created_at >= datetime('now', '-30 days')
      `);
      const requestsMonthResult = requestsMonthStmt.get() as { count: number };

      // Get top tokens by usage
      const topTokensStmt = this.db.prepare(`
        SELECT id, name, request_count
        FROM api_tokens
        WHERE request_count > 0
        ORDER BY request_count DESC
        LIMIT 10
      `);
      const topTokensRows = topTokensStmt.all() as { id: number; name: string; request_count: number }[];

      // Get top endpoints
      const topEndpointsStmt = this.db.prepare(`
        SELECT endpoint, COUNT(*) as count
        FROM token_usage_logs
        GROUP BY endpoint
        ORDER BY count DESC
        LIMIT 10
      `);
      const topEndpointsRows = topEndpointsStmt.all() as { endpoint: string; count: number }[];

      // Get daily usage for last 30 days
      const dailyUsageStmt = this.db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM token_usage_logs 
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
      const dailyUsageRows = dailyUsageStmt.all() as { date: string; count: number }[];

      // Get weekly usage for last 12 weeks
      const weeklyUsageStmt = this.db.prepare(`
        SELECT 
          strftime('%Y-W%W', created_at) as week,
          COUNT(*) as count
        FROM token_usage_logs 
        WHERE created_at >= datetime('now', '-84 days')
        GROUP BY strftime('%Y-W%W', created_at)
        ORDER BY week DESC
      `);
      const weeklyUsageRows = weeklyUsageStmt.all() as { week: string; count: number }[];

      // Get method distribution
      const methodDistributionStmt = this.db.prepare(`
        SELECT method, COUNT(*) as count
        FROM token_usage_logs
        GROUP BY method
        ORDER BY count DESC
      `);
      const methodDistributionRows = methodDistributionStmt.all() as { method: string; count: number }[];

      // Get status code distribution
      const statusCodeDistributionStmt = this.db.prepare(`
        SELECT 
          COALESCE(status_code, 0) as statusCode, 
          COUNT(*) as count
        FROM token_usage_logs
        WHERE status_code IS NOT NULL
        GROUP BY status_code
        ORDER BY count DESC
      `);
      const statusCodeDistributionRows = statusCodeDistributionStmt.all() as { statusCode: number; count: number }[];

      return {
        totalTokens: tokenCounts.total,
        activeTokens: tokenCounts.active,
        totalRequests: totalRequestsResult.total,
        requestsToday: requestsTodayResult.count,
        requestsThisWeek: requestsWeekResult.count,
        requestsThisMonth: requestsMonthResult.count,
        topTokens: topTokensRows.map(row => ({
          tokenId: row.id,
          name: row.name,
          requestCount: row.request_count
        })),
        topEndpoints: topEndpointsRows,
        dailyUsage: dailyUsageRows,
        weeklyUsage: weeklyUsageRows,
        methodDistribution: methodDistributionRows,
        statusCodeDistribution: statusCodeDistributionRows
      };
    } catch (error) {
      console.error('Error fetching usage analytics:', error);
      return {
        totalTokens: 0,
        activeTokens: 0,
        totalRequests: 0,
        requestsToday: 0,
        requestsThisWeek: 0,
        requestsThisMonth: 0,
        topTokens: [],
        topEndpoints: [],
        dailyUsage: [],
        weeklyUsage: [],
        methodDistribution: [],
        statusCodeDistribution: []
      };
    }
  }

  /**
   * Export usage data for analysis
   */
  async exportUsageData(includeUsageLogs: boolean = false): Promise<ExportData> {
    await this.initializeTables();

    try {
      // Get all tokens
      const tokens = await this.getTokens();

      // Get usage logs if requested
      let usageLogs: TokenUsageLog[] = [];
      if (includeUsageLogs) {
        const logsStmt = this.db.prepare(`
          SELECT 
            id, token_id, endpoint, method, ip_address, user_agent, 
            status_code, created_at
          FROM token_usage_logs 
          ORDER BY created_at DESC
          LIMIT 10000
        `);
        const logsRows = logsStmt.all() as any[];

        usageLogs = logsRows.map(row => ({
          id: row.id,
          tokenId: row.token_id,
          endpoint: row.endpoint,
          method: row.method,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          statusCode: row.status_code,
          createdAt: new Date(row.created_at)
        }));
      }

      // Get analytics
      const analytics = await this.getUsageAnalytics();

      return {
        tokens,
        usageLogs,
        analytics,
        exportedAt: new Date()
      };
    } catch (error) {
      console.error('Error exporting usage data:', error);
      throw new Error('Failed to export usage data');
    }
  }

  /**
   * Get usage patterns for a specific time period
   */
  async getUsagePatterns(days: number = 30): Promise<{
    hourlyDistribution: { hour: number; count: number }[];
    dailyDistribution: { dayOfWeek: number; count: number }[];
    peakUsageHours: { hour: number; count: number }[];
    averageRequestsPerDay: number;
  }> {
    await this.initializeTables();

    try {
      // Get hourly distribution
      const hourlyStmt = this.db.prepare(`
        SELECT 
          CAST(strftime('%H', created_at) AS INTEGER) as hour,
          COUNT(*) as count
        FROM token_usage_logs 
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY strftime('%H', created_at)
        ORDER BY hour
      `);
      const hourlyRows = hourlyStmt.all() as { hour: number; count: number }[];

      // Get daily distribution (0 = Sunday, 1 = Monday, etc.)
      const dailyStmt = this.db.prepare(`
        SELECT 
          CAST(strftime('%w', created_at) AS INTEGER) as dayOfWeek,
          COUNT(*) as count
        FROM token_usage_logs 
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY strftime('%w', created_at)
        ORDER BY dayOfWeek
      `);
      const dailyRows = dailyStmt.all() as { dayOfWeek: number; count: number }[];

      // Get peak usage hours (top 5)
      const peakHours = [...hourlyRows]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate average requests per day
      const totalRequestsStmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM token_usage_logs 
        WHERE created_at >= datetime('now', '-${days} days')
      `);
      const totalRequestsResult = totalRequestsStmt.get() as { count: number };
      const averageRequestsPerDay = Math.round(totalRequestsResult.count / days);

      return {
        hourlyDistribution: hourlyRows,
        dailyDistribution: dailyRows,
        peakUsageHours: peakHours,
        averageRequestsPerDay
      };
    } catch (error) {
      console.error('Error fetching usage patterns:', error);
      return {
        hourlyDistribution: [],
        dailyDistribution: [],
        peakUsageHours: [],
        averageRequestsPerDay: 0
      };
    }
  }

  /**
   * Get tokens that are expiring soon or already expired
   */
  async getExpiringTokens(warningDays: number = 7): Promise<{
    expiringSoon: ApiToken[];
    expired: ApiToken[];
    neverExpire: ApiToken[];
  }> {
    await this.initializeTables();

    try {
      const now = new Date();
      const warningDate = new Date(now.getTime() + (warningDays * 24 * 60 * 60 * 1000));

      // Get all tokens with expiration dates
      const stmt = this.db.prepare(`
        SELECT 
          id, name, description, token_prefix, permissions, status,
          expires_at, created_at, created_by, last_used_at, last_used_ip, request_count
        FROM api_tokens
        WHERE status != 'revoked'
        ORDER BY expires_at ASC
      `);

      const rows = stmt.all() as any[];
      const tokens = rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        tokenPrefix: row.token_prefix,
        permissions: row.permissions,
        status: row.status,
        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
        createdAt: new Date(row.created_at),
        createdBy: row.created_by,
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
        lastUsedIp: row.last_used_ip,
        requestCount: row.request_count || 0
      }));

      const expiringSoon: ApiToken[] = [];
      const expired: ApiToken[] = [];
      const neverExpire: ApiToken[] = [];

      tokens.forEach(token => {
        if (!token.expiresAt) {
          neverExpire.push(token);
        } else if (token.expiresAt < now) {
          expired.push(token);
        } else if (token.expiresAt <= warningDate) {
          expiringSoon.push(token);
        }
      });

      return {
        expiringSoon,
        expired,
        neverExpire
      };
    } catch (error) {
      console.error('Error fetching expiring tokens:', error);
      return {
        expiringSoon: [],
        expired: [],
        neverExpire: []
      };
    }
  }

  /**
   * Automatically expire tokens that have passed their expiration date
   */
  async processExpiredTokens(): Promise<{
    expiredCount: number;
    expiredTokens: { id: number; name: string; expiresAt: Date }[];
  }> {
    await this.initializeTables();

    try {
      // First, get the tokens that will be expired
      const selectStmt = this.db.prepare(`
        SELECT id, name, expires_at
        FROM api_tokens
        WHERE expires_at < datetime('now') 
          AND status = 'active'
      `);
      const expiredTokensData = selectStmt.all() as { id: number; name: string; expires_at: string }[];

      // Mark expired tokens as revoked
      const updateStmt = this.db.prepare(`
        UPDATE api_tokens 
        SET status = 'revoked' 
        WHERE expires_at < datetime('now') 
          AND status = 'active'
      `);
      const result = updateStmt.run();

      const expiredTokens = expiredTokensData.map(token => ({
        id: token.id,
        name: token.name,
        expiresAt: new Date(token.expires_at)
      }));

      if (result.changes > 0) {
        console.log(`Automatically expired ${result.changes} tokens`);
        expiredTokens.forEach(token => {
          console.log(`  - Token "${token.name}" (ID: ${token.id}) expired on ${token.expiresAt.toISOString()}`);
        });
      }

      return {
        expiredCount: result.changes,
        expiredTokens
      };
    } catch (error) {
      console.error('Error processing expired tokens:', error);
      return {
        expiredCount: 0,
        expiredTokens: []
      };
    }
  }

  /**
   * Get expiration status for a token
   */
  getTokenExpirationStatus(token: ApiToken, warningDays: number = 7): {
    status: 'expired' | 'expiring_soon' | 'active' | 'never_expires';
    daysUntilExpiration?: number;
    message: string;
  } {
    if (!token.expiresAt) {
      return {
        status: 'never_expires',
        message: 'This token never expires'
      };
    }

    const now = new Date();
    const expiresAt = new Date(token.expiresAt);
    const timeDiff = expiresAt.getTime() - now.getTime();
    const daysUntilExpiration = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysUntilExpiration < 0) {
      return {
        status: 'expired',
        daysUntilExpiration: Math.abs(daysUntilExpiration),
        message: `This token expired ${Math.abs(daysUntilExpiration)} day(s) ago`
      };
    } else if (daysUntilExpiration <= warningDays) {
      return {
        status: 'expiring_soon',
        daysUntilExpiration,
        message: daysUntilExpiration === 0
          ? 'This token expires today'
          : `This token expires in ${daysUntilExpiration} day(s)`
      };
    } else {
      return {
        status: 'active',
        daysUntilExpiration,
        message: `This token expires in ${daysUntilExpiration} day(s)`
      };
    }
  }

  /**
   * Clean up expired tokens and old usage logs with detailed reporting
   */
  async cleanupExpiredData(): Promise<{
    expiredTokens: number;
    oldLogs: number;
    expiredTokenDetails: { id: number; name: string; expiresAt: Date }[];
  }> {
    await this.initializeTables();

    try {
      // First get details of tokens that will be expired
      const expiredTokensStmt = this.db.prepare(`
        SELECT id, name, expires_at
        FROM api_tokens
        WHERE expires_at < datetime('now') 
          AND status = 'active'
      `);
      const expiredTokensData = expiredTokensStmt.all() as { id: number; name: string; expires_at: string }[];

      // Mark expired tokens as revoked
      const expiredStmt = this.db.prepare(`
        UPDATE api_tokens 
        SET status = 'revoked' 
        WHERE expires_at < datetime('now') 
          AND status = 'active'
      `);
      const expiredResult = expiredStmt.run();

      // Delete usage logs older than 90 days
      const oldLogsStmt = this.db.prepare(`
        DELETE FROM token_usage_logs 
        WHERE created_at < datetime('now', '-90 days')
      `);
      const oldLogsResult = oldLogsStmt.run();

      const expiredTokenDetails = expiredTokensData.map(token => ({
        id: token.id,
        name: token.name,
        expiresAt: new Date(token.expires_at)
      }));

      console.log(`Cleanup completed: ${expiredResult.changes} expired tokens, ${oldLogsResult.changes} old logs`);

      return {
        expiredTokens: expiredResult.changes,
        oldLogs: oldLogsResult.changes,
        expiredTokenDetails
      };
    } catch (error) {
      console.error('Error during cleanup:', error);
      return {
        expiredTokens: 0,
        oldLogs: 0,
        expiredTokenDetails: []
      };
    }
  }
}

// Export singleton instance
export const apiTokenService = new ApiTokenService(primaryDb);