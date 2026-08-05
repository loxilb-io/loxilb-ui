# Multi-stage build for LoxiLB UI
# Stage 1: Build the React application
FROM node:26-alpine AS builder

# Set working directory
WORKDIR /app

# Install native module build dependencies (optional)
RUN apk add --no-cache python3 make g++

# Install dependencies first (for better layer caching)
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# Copy source code and build
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NODE_ENV=production
# Build-time SPA config baked in by Create React App (it reads REACT_APP_* from
# the environment). These MUST be set at build time; the app has no runtime
# config, so an unset value ships a broken bundle. Historically they were only
# provided by a developer's local .env.local — which is (correctly) excluded
# from the image — so the defaults below are the source of truth for releases.
#
#   REACT_APP_API_URL    — OAM API base. Relative path the Caddy edge
#                          (deploy/compose) proxies to OAM; works on any
#                          host/scheme. Override to https://oam.host/oam only
#                          for a non-edge topology where the browser calls OAM
#                          directly.
#   REACT_APP_PUBLIC_URL  — React Router basename. The app is served under this
#                          prefix (Caddy/nginx both mount it at /netlox); an
#                          empty value 404s every route. Override only if you
#                          serve the SPA at a different prefix.
ARG REACT_APP_API_URL=/api/oam
ARG REACT_APP_PUBLIC_URL=/netlox
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_PUBLIC_URL=${REACT_APP_PUBLIC_URL}
RUN npm run build:prod

# Stage 2: Serve with nginx
FROM nginx:alpine

# Install required packages
RUN apk add --no-cache openssl bash curl gettext

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx base configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy SSL setup script
COPY ssl-setup.sh /usr/local/bin/ssl-setup.sh
RUN chmod +x /usr/local/bin/ssl-setup.sh

# Copy nginx configuration templates
COPY nginx-simple.conf.template /etc/nginx/conf.d/nginx-simple.conf.template
COPY nginx-https.conf.template /etc/nginx/conf.d/nginx-https.conf.template

# Copy new docker entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built React app
COPY --from=builder /app/build /usr/share/nginx/html

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

# Set default environment variables
ENV BACKEND_URL="https://oam.example.com"
ENV BACKEND_HOST="oam.example.com"
ENV FRONTEND_URL="http://localhost:3000"
ENV PUBLIC_PATH="/netlox"
ENV SSL_MODE="enabled"

# Expose ports
EXPOSE 80 443

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Use new entrypoint script
CMD ["/docker-entrypoint.sh"]