# Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/frontend/package.json packages/frontend/

# Install dependencies
RUN npm ci --workspace=@flash-sale/frontend

# Copy source
COPY packages/frontend packages/frontend

# Build
WORKDIR /app/packages/frontend
RUN npm run build


# Runtime (nginx)
FROM nginx:1.27-alpine

# Create non-root user
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S -u 1001 -G nginx-user nginx-user

# Copy nginx config - build context is the repo root, so this has to be
# qualified or it'd grab the root nginx.conf instead
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Fix permissions
RUN chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-user /var/run/nginx.pid

USER nginx-user

# 127.0.0.1, not localhost - alpine resolves localhost to ::1 first and
# nginx here only listens on IPv4
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
