#!/bin/sh
#
# Entrypoint for the standalone loxilb-ui container.
#
# Renders the nginx configuration from the templates according to SSL_MODE,
# then execs nginx. Every supported mode is validated here rather than left to
# nginx: a misconfigured container should say what is wrong and stop, not fail
# deep inside a config parse.
#
# Environment surface — see docs/container-image.md for the full reference.

set -eu

# ── Configuration ────────────────────────────────────────────────────────────
# These defaults are duplicated as ENV in the Dockerfile so that `docker inspect`
# reports the real surface; keep the two in sync.
BACKEND_URL=${BACKEND_URL:-""}
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:3000"}
PUBLIC_PATH=${PUBLIC_PATH:-"/netlox"}
SSL_MODE=${SSL_MODE:-"disabled"}
BACKEND_TLS_VERIFY=${BACKEND_TLS_VERIFY:-"off"}
HTTP_PORT=${HTTP_PORT:-8080}
HTTPS_PORT=${HTTPS_PORT:-8443}
HTTPS_REDIRECT_PORT=${HTTPS_REDIRECT_PORT:-""}

SSL_DIR=/etc/nginx/ssl
CERT_FILE="${SSL_DIR}/cert.pem"
KEY_FILE="${SSL_DIR}/key.pem"

die() {
    echo "ERROR: $*" >&2
    exit 1
}

# An unconfigured backend is not fatal — the container still serves the SPA, and
# the login page reports the unreachable backend itself. Point the proxy at a
# port nothing can be listening on so those calls fail immediately and
# unambiguously with 502. (Defaulting to the container's own HTTP port, as this
# once did, made nginx proxy /api/oam/* back to itself and answer API calls with
# the SPA shell — a 200 that looks like success and breaks the client.)
if [ -z "$BACKEND_URL" ]; then
    echo "WARNING: BACKEND_URL is not set — the console will load but every API" >&2
    echo "         call returns 502. Set it to your loxilb-oam base URL." >&2
    BACKEND_URL="http://127.0.0.1:1"
fi

# Trailing slashes would produce a double slash in the proxied path
# (<backend>//oam/...), which some routers treat as a distinct, unmatched route.
BACKEND_URL=${BACKEND_URL%/}

# Default the proxied Host header to the backend URL's authority. Deriving it
# removes the most common standalone misconfiguration: a BACKEND_URL and a
# BACKEND_HOST that disagree, which reaches the right server and then gets
# rejected by its virtual-host or certificate matching.
if [ -z "${BACKEND_HOST:-}" ]; then
    BACKEND_HOST=$(echo "$BACKEND_URL" | sed -e 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##' -e 's#/.*$##' -e 's#^.*@##')
fi

case "$PUBLIC_PATH" in
    /*/) die "PUBLIC_PATH must not end in '/' (got '${PUBLIC_PATH}')" ;;
    /?*) : ;;
    # An empty prefix would render `location /` twice and serve nothing. The
    # bundle's REACT_APP_PUBLIC_URL is baked in at build time, so this must
    # match whatever the image was built with.
    *) die "PUBLIC_PATH must be an absolute path such as '/netlox' (got '${PUBLIC_PATH}')" ;;
esac

case "$BACKEND_TLS_VERIFY" in
    on|off) : ;;
    *) die "BACKEND_TLS_VERIFY must be 'on' or 'off' (got '${BACKEND_TLS_VERIFY}')" ;;
esac

# Accept "3443" or ":3443"; empty means the TLS port is reachable on 443 and
# the redirect needs no port at all.
if [ -n "$HTTPS_REDIRECT_PORT" ]; then
    HTTPS_REDIRECT_PORT=":${HTTPS_REDIRECT_PORT#:}"
fi

export BACKEND_URL BACKEND_HOST FRONTEND_URL PUBLIC_PATH BACKEND_TLS_VERIFY \
       HTTP_PORT HTTPS_PORT HTTPS_REDIRECT_PORT

echo "loxilb-ui ${LOXILB_UI_VERSION:-dev} — configuring nginx"
echo "  SSL_MODE            : ${SSL_MODE}"
echo "  BACKEND_URL         : ${BACKEND_URL}"
echo "  BACKEND_HOST        : ${BACKEND_HOST}"
echo "  BACKEND_TLS_VERIFY  : ${BACKEND_TLS_VERIFY}"
echo "  FRONTEND_URL        : ${FRONTEND_URL}"
echo "  PUBLIC_PATH         : ${PUBLIC_PATH}"
echo "  HTTP_PORT           : ${HTTP_PORT}"

# ── Resolver ─────────────────────────────────────────────────────────────────
# The OAM upstream is proxied through a variable so nginx resolves it per
# request; that requires a resolver. Take the container's own nameservers so
# this works identically under Docker (127.0.0.11) and Kubernetes (cluster DNS).
NAMESERVERS=$(awk '/^nameserver/ { if ($2 ~ /:/) printf "[%s] ", $2; else printf "%s ", $2 }' /etc/resolv.conf 2>/dev/null || true)
[ -n "$NAMESERVERS" ] || NAMESERVERS="127.0.0.11"
printf 'resolver %sipv6=off valid=30s;\nresolver_timeout 5s;\n' "$NAMESERVERS" > /etc/nginx/resolver.conf

# ── Render ───────────────────────────────────────────────────────────────────
SUBST='${BACKEND_URL} ${BACKEND_HOST} ${FRONTEND_URL} ${PUBLIC_PATH} ${BACKEND_TLS_VERIFY} ${HTTP_PORT} ${HTTPS_PORT} ${HTTPS_REDIRECT_PORT}'

render() {
    [ -f "$1" ] || die "template not found: $1 (corrupt image?)"
    envsubst "$SUBST" < "$1" > "$2"
}

mkdir -p /etc/nginx/snippets
render /etc/nginx/templates/app.conf.template /etc/nginx/snippets/app.conf

generate_self_signed() {
    echo "  generating self-signed certificate (valid 365 days)"
    mkdir -p "$SSL_DIR"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" -out "$CERT_FILE" \
        -subj "/C=US/ST=State/L=City/O=LoxiLB/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1" \
        >/dev/null 2>&1
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE"
}

case "$SSL_MODE" in
    disabled|http)
        echo "  HTTP only — terminate TLS at your own edge"
        render /etc/nginx/templates/http.conf.template /etc/nginx/conf.d/default.conf
        ;;

    enabled|https|ssl)
        echo "  HTTPS on ${HTTPS_PORT} (self-signed unless certificates are mounted)"
        if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
            generate_self_signed
        else
            echo "  using existing certificate at ${CERT_FILE}"
        fi
        render /etc/nginx/templates/https.conf.template /etc/nginx/conf.d/default.conf
        ;;

    commercial)
        # Production mode: certificates come from the operator. Falling back to
        # a self-signed pair here would turn a cert-mounting mistake into a
        # container that looks healthy and breaks every browser that reaches it.
        echo "  HTTPS on ${HTTPS_PORT} with operator-provided certificates"
        [ -f "$CERT_FILE" ] || die "SSL_MODE=commercial requires a certificate at ${CERT_FILE} (mount it, e.g. -v \$PWD/ssl:${SSL_DIR}:ro)"
        [ -f "$KEY_FILE" ] || die "SSL_MODE=commercial requires a private key at ${KEY_FILE} (mount it, e.g. -v \$PWD/ssl:${SSL_DIR}:ro)"
        if ! /usr/local/bin/ssl-setup.sh validate >/dev/null 2>&1; then
            die "the certificate and key at ${SSL_DIR} do not match — run 'ssl-setup.sh validate' for details"
        fi
        render /etc/nginx/templates/https.conf.template /etc/nginx/conf.d/default.conf
        ;;

    *)
        die "SSL_MODE must be one of: disabled | enabled | commercial (got '${SSL_MODE}')"
        ;;
esac

# ── Start ────────────────────────────────────────────────────────────────────
nginx -t
exec nginx -g "daemon off;"
