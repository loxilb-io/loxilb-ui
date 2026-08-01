#!/bin/sh

# Docker entrypoint script for LoxiLB UI
# This script processes nginx configuration templates with environment variables

set -e

# Default values
export BACKEND_URL=${BACKEND_URL:-"https://oam.example.com"}
export BACKEND_HOST=${BACKEND_HOST:-"oam.example.com"}
export FRONTEND_URL=${FRONTEND_URL:-"http://localhost:3000"}
export PUBLIC_PATH=${PUBLIC_PATH:-"/netlox"}
export SSL_MODE=${SSL_MODE:-"disabled"}

echo "🔧 Configuring nginx with environment variables..."
echo "   BACKEND_URL: ${BACKEND_URL}"
echo "   BACKEND_HOST: ${BACKEND_HOST}"
echo "   FRONTEND_URL: ${FRONTEND_URL}"
echo "   PUBLIC_PATH: ${PUBLIC_PATH}"
echo "   SSL_MODE: ${SSL_MODE}"

# Function to process template files
process_template() {
    local template_file="$1"
    local output_file="$2"
    
    if [ -f "${template_file}" ]; then
        echo "📝 Processing template: ${template_file} -> ${output_file}"
        envsubst '${BACKEND_URL} ${BACKEND_HOST} ${FRONTEND_URL} ${PUBLIC_PATH}' < "${template_file}" > "${output_file}"
    else
        echo "⚠️  Template file not found: ${template_file}"
    fi
}

# Create nginx configuration based on SSL mode
case "${SSL_MODE}" in
    "enabled"|"https"|"ssl")
        echo "🔒 Configuring HTTPS mode"
        process_template "/etc/nginx/conf.d/nginx-https.conf.template" "/etc/nginx/conf.d/default.conf"
        
        # Check if SSL certificates exist, if not create self-signed ones
        if [ ! -f "/etc/nginx/ssl/cert.pem" ] || [ ! -f "/etc/nginx/ssl/key.pem" ]; then
            echo "🔑 Generating self-signed SSL certificate..."
            mkdir -p /etc/nginx/ssl
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /etc/nginx/ssl/key.pem \
                -out /etc/nginx/ssl/cert.pem \
                -subj "/C=US/ST=State/L=City/O=LoxiLB/CN=localhost"
            chmod 600 /etc/nginx/ssl/key.pem
            chmod 644 /etc/nginx/ssl/cert.pem
        fi
        ;;
    "disabled"|"http"|*)
        echo "🔓 Configuring HTTP mode"
        process_template "/etc/nginx/conf.d/nginx-simple.conf.template" "/etc/nginx/conf.d/default.conf"
        ;;
esac

# Validate nginx configuration
echo "✅ Validating nginx configuration..."
nginx -t

# Start nginx
echo "🚀 Starting nginx..."
exec nginx -g "daemon off;"