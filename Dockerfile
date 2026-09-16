# Multi-stage Dockerfile for Badatel
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production runner image
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5173
ENV HOST=0.0.0.0

# Install runtime dependencies for sharp / image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package definitions and install production only modules
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled frontend and server files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

# Ensure uploads and data directories exist
RUN mkdir -p /app/public/uploads /app/data

EXPOSE 5173

CMD ["node", "server.js"]
