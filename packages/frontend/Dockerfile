# ============= Build Stage =============
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/frontend/package.json packages/frontend/

# Install dependencies
RUN npm ci --workspace=@flash-sale/frontend

# Copy source code
COPY packages/frontend packages/frontend

# Build React app with Vite
WORKDIR /app/packages/frontend
RUN npm run build


# ============= Runtime Stage (Nginx) =============
FROM nginx:1.27-alpine

# Create non-root user
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S -u 1001 -G nginx-user nginx-user

# Copy nginx config from separate file. Build context is the repo root
# (see docker-compose.prod.yml), so this must be qualified - an
# unqualified `nginx.conf` would resolve to the root reverse-proxy config
# instead of this static-file-server one.
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app from builder
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Change ownership
RUN chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-user /var/run/nginx.pid

# Switch to non-root user
USER nginx-user

# Health check - 127.0.0.1, not "localhost": Alpine/musl resolves
# "localhost" to ::1 first, but nginx here only listens on IPv4, so a
# hostname lookup would connect-refuse and never pass.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]