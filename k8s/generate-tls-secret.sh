#!/bin/bash

# Generate self-signed TLS certificate for Kubernetes
echo "🔐 Generating self-signed TLS certificate for Kubernetes..."

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout tls.key \
    -out tls.crt \
    -subj "/C=US/ST=State/L=City/O=LoxiLB/CN=loxilb-ui.local"

# Create Kubernetes TLS secret
kubectl create secret tls loxilb-ui-tls \
    --cert=tls.crt \
    --key=tls.key \
    --namespace=loxilb-system \
    --dry-run=client -o yaml > ../tls-secret.yaml

echo "✅ TLS secret created: tls-secret.yaml"
echo "Apply with: kubectl apply -f tls-secret.yaml"

# Cleanup
cd - > /dev/null
rm -rf "$TEMP_DIR"