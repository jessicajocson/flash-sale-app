# ============= Build Stage =============
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for all workspaces
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/

# Install dependencies
RUN npm ci --workspace=@flash-sale/server

# Copy source code
COPY packages/server packages/server

# Build TypeScript
WORKDIR /app/packages/server
RUN npm run build


# ============= Runtime Stage =============
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/

# Install production dependencies only
RUN npm ci --workspace=@flash-sale/server --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check - 127.0.0.1, not "localhost": Alpine/musl resolves
# "localhost" to ::1 first, but the server only binds IPv4 (HOST=0.0.0.0),
# so a hostname lookup here would connect-refuse and never pass. wget
# (from busybox, already present in node:alpine) starts faster and more
# reliably under the Docker healthcheck runner than spawning a fresh V8.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:3001/health || exit 1

EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]