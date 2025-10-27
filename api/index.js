// Import your Express app and initialization promise
import app, { initializationPromise } from '../dist/index.js';

// Create a wrapper handler that waits for initialization
const handler = async (req, res) => {
  // Wait for routes to be initialized before handling requests
  await initializationPromise;
  
  return app(req, res);
};

// Export the handler for Vercel
export default handler;
