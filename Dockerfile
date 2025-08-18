# Multi-stage build for React app with nginx

# Stage 1: Build the React application
FROM node:18-alpine AS builder
WORKDIR /app

# (선택) 네이티브 모듈 빌드 대비
RUN apk add --no-cache python3 make g++

# 1) 의존성만 먼저 설치 (lockfile 기반 재현성)
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# 2) 소스 복사 후 빌드
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Install OpenSSL for certificate generation
RUN apk add --no-cache openssl bash

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/nginx.conf

# Copy SSL setup script
COPY ssl-setup.sh /usr/local/bin/ssl-setup.sh
RUN chmod +x /usr/local/bin/ssl-setup.sh

# Copy nginx configurations
COPY nginx-simple.conf /etc/nginx/conf.d/nginx-simple.conf
COPY nginx-https.conf /etc/nginx/conf.d/nginx-https.conf

# Copy built React app
COPY --from=builder /app/build /usr/share/nginx/html

# Create startup script
RUN echo '#!/bin/bash' > /docker-entrypoint.sh && \
    echo 'set -e' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo '# Setup SSL certificates' >> /docker-entrypoint.sh && \
    echo '/usr/local/bin/ssl-setup.sh auto' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo '# Choose nginx configuration based on SSL_MODE' >> /docker-entrypoint.sh && \
    echo 'if [ "$SSL_MODE" = "disabled" ]; then' >> /docker-entrypoint.sh && \
    echo '    echo "Running in HTTP-only mode"' >> /docker-entrypoint.sh && \
    echo '    rm -f /etc/nginx/conf.d/nginx-https.conf' >> /docker-entrypoint.sh && \
    echo '    ln -sf /etc/nginx/conf.d/nginx-simple.conf /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'else' >> /docker-entrypoint.sh && \
    echo '    echo "Running in HTTPS mode (with HTTP redirect)"' >> /docker-entrypoint.sh && \
    echo '    rm -f /etc/nginx/conf.d/nginx-simple.conf' >> /docker-entrypoint.sh && \
    echo '    ln -sf /etc/nginx/conf.d/nginx-https.conf /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'fi' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo '# Start nginx' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

EXPOSE 80 443
CMD ["/docker-entrypoint.sh"]
