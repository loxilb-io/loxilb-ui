#!/bin/bash

# SSL Certificate Management Script for loxilb-ui
# This script generates self-signed certificates or prepares for commercial certificates

SSL_DIR="/etc/nginx/ssl"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Function to generate self-signed certificate
generate_self_signed() {
    echo "Generating self-signed SSL certificate..."
    
    # Generate private key
    openssl genrsa -out "$KEY_FILE" 2048
    
    # Generate certificate
    openssl req -new -x509 -key "$KEY_FILE" -out "$CERT_FILE" -days 365 \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"
    
    echo "Self-signed certificate generated successfully!"
    echo "Certificate: $CERT_FILE"
    echo "Private Key: $KEY_FILE"
}

# Function to check if commercial certificates exist
check_commercial_certs() {
    if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
        # Verify it's not a self-signed certificate
        if openssl x509 -in "$CERT_FILE" -text -noout | grep -q "Issuer.*Subject.*CN=localhost"; then
            return 1  # Self-signed
        else
            return 0  # Commercial
        fi
    else
        return 1  # Not found
    fi
}

# Function to validate certificate
validate_certificate() {
    if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
        # Check if certificate and key match
        cert_modulus=$(openssl x509 -noout -modulus -in "$CERT_FILE" | openssl md5)
        key_modulus=$(openssl rsa -noout -modulus -in "$KEY_FILE" | openssl md5)
        
        if [[ "$cert_modulus" == "$key_modulus" ]]; then
            echo "Certificate and private key match ✓"
            
            # Show certificate details
            echo "Certificate details:"
            openssl x509 -in "$CERT_FILE" -text -noout | grep -E "(Subject|Issuer|Not Before|Not After|DNS:|IP:)"
            return 0
        else
            echo "Error: Certificate and private key do not match!"
            return 1
        fi
    else
        echo "Error: Certificate or private key not found!"
        return 1
    fi
}

# Main logic
case "${1:-auto}" in
    "self-signed"|"self")
        generate_self_signed
        validate_certificate
        ;;
    "commercial"|"comm")
        if check_commercial_certs; then
            echo "Commercial certificates found!"
            validate_certificate
        else
            echo "Commercial certificates not found."
            echo "Please place your commercial certificate and private key in:"
            echo "  Certificate: $CERT_FILE"
            echo "  Private Key: $KEY_FILE"
            echo ""
            echo "Generating self-signed certificate as fallback..."
            generate_self_signed
            validate_certificate
        fi
        ;;
    "validate"|"check")
        validate_certificate
        ;;
    "auto"|*)
        echo "SSL Certificate Auto-Setup"
        echo "=========================="
        
        if check_commercial_certs; then
            echo "Commercial certificates found and will be used."
            validate_certificate
        else
            echo "No commercial certificates found."
            echo "Generating self-signed certificate..."
            generate_self_signed
            validate_certificate
        fi
        ;;
esac

# Set proper permissions
chmod 600 "$KEY_FILE" 2>/dev/null || true
chmod 644 "$CERT_FILE" 2>/dev/null || true

echo ""
echo "SSL setup complete! The nginx server will use certificates from:"
echo "  Certificate: $CERT_FILE"
echo "  Private Key: $KEY_FILE"
