import cron from 'node-cron';
import { ShipmentQueries } from '../db/queries.js';
import { log } from '../vite.js';

// Reset live database daily at midnight
cron.schedule('0 0 * * *', () => {
  try {
    log('Starting daily database reset...', 'scheduler');
    const queries = new ShipmentQueries(false); // Live DB
    queries.resetDatabase();
    log('Live database reset completed successfully', 'scheduler');
  } catch (error) {
    console.error('Failed to reset live database:', error);
    log(`Database reset failed: ${error}`, 'scheduler');
  }
});

// Cleanup replica database daily at 1 AM (keep last 3 days)
cron.schedule('0 1 * * *', () => {
  try {
    log('Starting replica database cleanup...', 'scheduler');
    const replicaQueries = new ShipmentQueries(true); // Replica DB
    replicaQueries.cleanupOldData(3);
    log('Replica database cleanup completed successfully', 'scheduler');
  } catch (error) {
    console.error('Failed to cleanup replica database:', error);
    log(`Database cleanup failed: ${error}`, 'scheduler');
  }
});

log('Database scheduler initialized', 'scheduler');
