# Use Node 20
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install -g npm@6.14.17 && npm ci

# Copy source code
COPY . .

# Expose the port
EXPOSE 5004

# Set environment variables
ENV NODE_ENV=development

# Start the development server
CMD ["npm", "run", "dev"]
