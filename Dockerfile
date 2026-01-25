# Use Node 20
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for client-side logging
ARG VITE_ENABLE_CONSOLE_LOGS
ARG VITE_LOG_LEVEL
ENV VITE_ENABLE_CONSOLE_LOGS=$VITE_ENABLE_CONSOLE_LOGS
ENV VITE_LOG_LEVEL=$VITE_LOG_LEVEL

# Build the application
RUN npm run build

# Expose the port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=development
ENV PORT=5000

# Start the application
CMD ["npm", "run", "dev:local"]
