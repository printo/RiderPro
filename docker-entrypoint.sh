#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ]; then
    echo "🚀 Starting in PRODUCTION mode..."
    # Build the application
    npm run build
    # Start the production server
    npm start
else
    echo "🛠️ Starting in DEVELOPMENT mode..."
    # Start the development server
    npm run dev:local
fi
