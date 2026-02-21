# Sentinel Shield Proxy Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for diagnostics (netstat)
RUN apk add --no-cache net-tools

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Command to run the proxy
CMD ["node", "index.js"]
