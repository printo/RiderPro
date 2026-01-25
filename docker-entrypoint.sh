#!/bin/sh
set -e

echo "🚀 Starting RiderPro (NODE_ENV=$NODE_ENV)"

if [ "$NODE_ENV" = "production" ]; then
    exec node -r dotenv/config dist/index.js
else
    # Development mode with hot-reload
    # Ensure dependencies are installed if node_modules is empty (due to volume mount)
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm ci
    fi
    exec npm run dev:local
fi
