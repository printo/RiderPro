import { db } from '../db/pg-connection.js';
import bcrypt from 'bcrypt';

export interface RiderRecord {
  id: string;
  rider_id: string;
  full_name: string;
  is_active: boolean;
  is_approved: boolean;
  role: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export class RiderService {
  async listRiders(): Promise<RiderRecord[]> {
    const res = await db.query('SELECT id, rider_id, full_name, is_active, is_approved, role, last_login_at, created_at, updated_at FROM rider_accounts WHERE is_active = TRUE ORDER BY full_name');
    return res.rows as unknown as RiderRecord[];
  }

  async listUnregisteredRiderIds(candidateIds: string[]): Promise<string[]> {
    if (!candidateIds || candidateIds.length === 0) return [];
    const placeholders = candidateIds.map((_, i) => `$${i + 1}`).join(',');
    const q = `SELECT UNNEST(ARRAY[${placeholders}]) AS rider_id EXCEPT SELECT rider_id FROM rider_accounts`;
    const res = await db.query(q, candidateIds);
    return res.rows.map(r => r.rider_id);
  }

  async registerRider(riderId: string, fullName: string, password: string): Promise<RiderRecord> {
    this.assertPassword(password);
    const hash = await bcrypt.hash(password, 10);
    const userId = 'rider_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    const insert = `
      INSERT INTO rider_accounts (id, rider_id, full_name, password_hash, is_active, is_approved, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, TRUE, FALSE, 'driver', NOW(), NOW())
      RETURNING id, rider_id, full_name, is_active, is_approved, role, last_login_at, created_at, updated_at
    `;
    const res = await db.query(insert, [userId, riderId, fullName, hash]);
    return res.rows[0] as RiderRecord;
  }

  async login(riderId: string, password: string): Promise<RiderRecord | null> {
    const row = await db.query('SELECT id, rider_id, full_name, password_hash, is_active, is_approved, role, last_login_at, created_at, updated_at FROM rider_accounts WHERE rider_id = $1', [riderId]);
    if (!row.rows.length) return null;
    const rec: any = row.rows[0];
    const ok = await bcrypt.compare(password, rec.password_hash);
    if (!ok || !rec.is_active) return null;
    
    // Update last login time
    await db.query('UPDATE rider_accounts SET last_login_at = NOW(), updated_at = NOW() WHERE rider_id = $1', [riderId]);
    
    return { 
      id: rec.id,
      rider_id: rec.rider_id, 
      full_name: rec.full_name, 
      is_active: rec.is_active, 
      is_approved: rec.is_approved,
      role: rec.role,
      last_login_at: new Date().toISOString(),
      created_at: rec.created_at, 
      updated_at: rec.updated_at 
    } as RiderRecord;
  }

  private assertPassword(pw: string) {
    if (pw.length < 6) throw new Error('Password must be at least 6 characters');
    if (!/[a-z]/.test(pw)) throw new Error('Password needs a lowercase letter');
    if (!/[A-Z]/.test(pw)) throw new Error('Password needs an uppercase letter');
    if (!/[0-9]/.test(pw)) throw new Error('Password needs a number');
  }
}

export const riderService = new RiderService();


