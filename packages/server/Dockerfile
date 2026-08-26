# Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/

# Install dependencies
RUN npm ci --workspace=@flash-sale/server

# Copy source
COPY packages/server packages/server

# Build
WORKDIR /app/packages/server
RUN npm run build


# Runtime
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/

# Install dependencies
RUN npm ci --workspace=@flash-sale/server --omit=dev && \
    npm cache clean --force

# Copy build output
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Fix permissions
RUN chown -R nodejs:nodejs /app

USER nodejs

# 127.0.0.1, not localhost - alpine resolves localhost to ::1 first and
# the server only binds IPv4, so it'd never pass
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:3001/health || exit 1

EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]
