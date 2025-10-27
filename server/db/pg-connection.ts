import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

dotenv.config();

// Configure WebSocket for local development
neonConfig.webSocketConstructor = ws;

// Create a connection pool
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('❌ This is a required configuration. Please set DATABASE_URL in your environment.');
  throw new Error('DATABASE_URL must be configured. Please add it to your Vercel environment variables.');
}

// Create the pool
export const pool = new Pool({ connectionString: databaseUrl });

// Test the connection
pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ PostgreSQL database connected successfully');
  })
  .catch((err) => {
    console.error('❌ Failed to connect to PostgreSQL database:', err.message);
    console.error('Please check your DATABASE_URL environment variable');
  });

// Helper function to execute queries with SQLite-like interface
export class PostgresWrapper {
  private pool: Pool;

  constructor(poolInstance: Pool) {
    this.pool = poolInstance;
  }

  // SQLite-like prepare method that returns an object with get/all/run methods
  prepare(sql: string) {
    return {
      get: async (...params: any[]) => {
        // Convert ? placeholders to $1, $2, etc. for PostgreSQL
        const pgSql = this.convertPlaceholders(sql);
        const result = await this.pool.query(pgSql, params);
        return result.rows[0] || null;
      },
      all: async (...params: any[]) => {
        const pgSql = this.convertPlaceholders(sql);
        const result = await this.pool.query(pgSql, params);
        return result.rows;
      },
      run: async (...params: any[]) => {
        const pgSql = this.convertPlaceholders(sql);
        const result = await this.pool.query(pgSql, params);
        return {
          changes: result.rowCount || 0,
          lastInsertRowid: result.rows[0]?.id || null
        };
      }
    };
  }

  // Execute raw SQL (for CREATE TABLE, etc.)
  async exec(sql: string) {
    const statements = sql.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await this.pool.query(statement);
      }
    }
  }

  // Direct query access
  async query(sql: string, params: any[] = []) {
    const pgSql = this.convertPlaceholders(sql);
    return this.pool.query(pgSql, params);
  }

  // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
  private convertPlaceholders(sql: string): string {
    let index = 0;
    return sql.replace(/\?/g, () => {
      index++;
      return `$${index}`;
    });
  }
}

// Create wrapper instance
export const db = new PostgresWrapper(pool);

// For backwards compatibility, export as primaryDb
export const primaryDb = db;
export const secondaryDb = db;

// Default export
export default db;




