// Import your Express app from the built server
// The app is initialized with routes when this module loads
import app from '../dist/index.js';

// Export the app as the Vercel handler
// Routes are registered during module initialization
export default app;
