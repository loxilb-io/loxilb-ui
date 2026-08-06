#!/bin/sh
#
# Certificate helper for the standalone loxilb-ui container.
#
#   ssl-setup.sh self-signed   regenerate the development certificate
#   ssl-setup.sh validate      check that cert.pem and key.pem match, print details
#
# The entrypoint generates a self-signed pair on its own when SSL_MODE=enabled
# finds none, so this script is for operating a running container:
#
#   docker exec <container> /usr/local/bin/ssl-setup.sh validate
#
# Operator-provided certificates are mounted at ${SSL_DIR}, not installed by
# this script — see docs/container-image.md.

set -eu

SSL_DIR="${SSL_DIR:-/etc/nginx/ssl}"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

generate_self_signed() {
    mkdir -p "$SSL_DIR"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" -out "$CERT_FILE" \
        -subj "/C=US/ST=State/L=City/O=LoxiLB/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE"
    echo "Self-signed certificate written to ${CERT_FILE}"
    echo "Restart the container for nginx to pick it up."
}

validate() {
    if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
        echo "Certificate or private key not found in ${SSL_DIR}" >&2
        return 1
    fi

    # A cert and key belong together iff their public moduli agree.
    cert_modulus=$(openssl x509 -noout -modulus -in "$CERT_FILE" | openssl md5)
    key_modulus=$(openssl rsa -noout -modulus -in "$KEY_FILE" | openssl md5)
    if [ "$cert_modulus" != "$key_modulus" ]; then
        echo "Certificate and private key do not match" >&2
        return 1
    fi

    echo "Certificate and private key match"
    openssl x509 -in "$CERT_FILE" -text -noout |
        grep -E "(Subject:|Issuer:|Not Before|Not After|DNS:|IP Address:)"
}

case "${1:-validate}" in
    self-signed|self) generate_self_signed ;;
    validate|check)   validate ;;
    *)
        echo "usage: ssl-setup.sh [self-signed|validate]" >&2
        exit 2
        ;;
esac
