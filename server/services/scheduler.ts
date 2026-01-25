import cron from 'node-cron';
import { pool } from '../db/connection.js';
import { log } from '../vite.js';

// Cleanup old route tracking data daily at 3 AM (keep last 30 days)
cron.schedule('0 3 * * *', async () => {
  try {
    log('Starting route data cleanup...', 'scheduler');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    await pool.query('DELETE FROM route_tracking WHERE date < $1', [cutoffDate.toISOString().split('T')[0]]);
    
    log('Route data cleanup completed successfully', 'scheduler');
  } catch (error) {
    console.error('Failed to cleanup route data:', error);
    log(`Route cleanup failed: ${error}`, 'scheduler');
  }
});

log('Database scheduler initialized', 'scheduler');
