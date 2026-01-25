#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ]; then
    echo "🚀 Starting in PRODUCTION mode..."
    # Build the application (only if not already built or forced)
    # Note: In a real production setup, you might want to separate build and run stages.
    # For now, we build on startup to ensure latest code, but we must handle the exit code correctly.
    echo "🏗️ Building application..."
    # We want to run db:init separately to ensure DB is ready, but it's part of build script currently.
    # If build fails, the container should exit with error so Docker can restart it (but we don't want a loop if code is bad).
    # However, 'npm run build' includes db:init which might fail if DB isn't ready, but depends_on handles that mostly.
    
    if npm run build; then
        echo "✅ Build complete. Starting server..."
        exec npm start
    else
        echo "❌ Build failed. Sleeping for 30s to avoid tight restart loop..."
        sleep 30
        exit 1
    fi
else
    echo "🛠️ Starting in DEVELOPMENT mode..."
    # Start the development server
    npm run dev:local
fi
