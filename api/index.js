// Import your Express app and initialization promise
import app, { initializationPromise } from '../dist/index.js';

// Create a wrapper handler that waits for initialization
const handler = async (req, res) => {
  try {
    // Wait for routes to be initialized before handling requests
    await initializationPromise;
    
    return app(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ 
      error: true, 
      message: 'Internal server error',
      details: error.message 
    });
  }
};

// Export the handler for Vercel
export default handler;
