// Import your Express app and initialization promise
import app, { initializationPromise } from '../dist/index-no-vite.js';

console.log('📦 API Handler module loaded');

// Create a wrapper handler that waits for initialization
const handler = async (req, res) => {
  console.log(`🌐 Incoming request: ${req.method} ${req.url}`);
  
  try {
    console.log('⏳ Waiting for initialization promise...');
    // Wait for routes to be initialized before handling requests
    await initializationPromise;
    console.log('✅ Initialization complete, forwarding to app');
    
    return app(req, res);
  } catch (error) {
    console.error('❌ Handler error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: true, 
      message: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

console.log('✅ Handler exported');

// Export the handler for Vercel
export default handler;
