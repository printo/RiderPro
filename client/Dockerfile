FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/ 2>/dev/null || true

# Install dependencies
RUN npm ci || npm install

# Copy client source
COPY client/ ./client/
COPY shared/ ./shared/

# Expose Vite dev server port
EXPOSE 5004

WORKDIR /app/client

# Start Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5004"]

