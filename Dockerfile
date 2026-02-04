# Use Node 24.1.0 to match local environment
FROM node:24.1.0-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install -g npm@11.8.0 && npm ci

# Copy source code
COPY . .

# Expose the port
EXPOSE 5004

# Set environment variables
ENV NODE_ENV=development

# Start the development server
CMD ["npm", "run", "dev"]
