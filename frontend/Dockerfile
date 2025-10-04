# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (need dev deps for CRA build)
COPY package*.json ./
RUN npm ci

# Copy source
COPY public/ ./public/
COPY src/ ./src/

# Build
ENV CI=true
RUN npm run build

# Production stage
FROM nginx:alpine

# Add tools for env substitution
RUN apk add --no-cache bash gettext

# Copy nginx config as a template; we'll envsubst $API_URL at runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Copy build output
COPY --from=builder /app/build /usr/share/nginx/html

# Prepare permissions for non-root
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx || true && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Render nginx config from template then start nginx
CMD ["/bin/sh", "-c", "API_URL=${API_URL:-http://localhost:8080}; export API_URL; envsubst '$API_URL' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'" ]
