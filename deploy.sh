#!/usr/bin/env bash
#
# Convenience wrapper around the standalone Compose stack.
#
#   ./deploy.sh [http|https|commercial] [up|down|restart|logs|status]
#
# Every mode is an overlay on docker-compose.yml; this script only picks the
# overlay pair and prints the resulting URLs. Running the compose commands
# directly is equally supported — see the header of docker-compose.yml.

set -euo pipefail

MODE="${1:-https}"
ACTION="${2:-up}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }

HTTP_PORT="${UI_HTTP_PORT:-3000}"
HTTPS_PORT="${UI_HTTPS_PORT:-3443}"

usage() {
    cat <<EOF
Usage: $0 [mode] [action]

Modes:
  http        HTTP only — terminate TLS at your own edge
  https       HTTPS with a self-signed certificate (default)
  commercial  HTTPS with certificates you place in ./ssl/

Actions:
  up | down | restart | logs | status

Examples:
  $0                      # HTTPS, self-signed
  $0 http up              # HTTP only
  $0 commercial up        # HTTPS with your certificates
  $0 https logs           # follow logs
EOF
}

case "${1:-}" in -h|--help|help) usage; exit 0 ;; esac

case "$MODE" in
    http)       OVERLAY=docker-compose.http.yml ;;
    https)      OVERLAY=docker-compose.https.yml ;;
    commercial) OVERLAY=docker-compose.commercial.yml ;;
    *) error "Invalid mode: $MODE"; usage; exit 1 ;;
esac

# Compose v2 is a docker subcommand; the standalone docker-compose binary is
# end-of-life and is not used here.
if ! docker compose version >/dev/null 2>&1; then
    error "Docker Compose v2 is required ('docker compose version' failed)"
    exit 1
fi

compose() { docker compose -f docker-compose.yml -f "$OVERLAY" "$@"; }

show_urls() {
    if [[ "$MODE" == "http" ]]; then
        success "loxilb-ui is running (HTTP)"
        info "  http://localhost:${HTTP_PORT}/netlox/"
    else
        success "loxilb-ui is running (HTTPS)"
        info "  https://localhost:${HTTPS_PORT}/netlox/"
        info "  http://localhost:${HTTP_PORT}/  redirects to HTTPS"
        [[ "$MODE" == "https" ]] && warn "Self-signed certificate — browsers will warn"
    fi
    info "Backend: ${BACKEND_URL:-unset — set BACKEND_URL in .env or the UI has nothing to talk to}"
}

case "$ACTION" in
    up)
        if [[ "$MODE" == "commercial" ]]; then
            [[ -f ssl/cert.pem && -f ssl/key.pem ]] || {
                error "commercial mode needs ssl/cert.pem and ssl/key.pem"
                info "  mkdir -p ssl && cp your-cert.pem ssl/cert.pem && cp your-key.pem ssl/key.pem"
                exit 1
            }
        fi
        info "Starting loxilb-ui (${MODE})..."
        compose up -d
        # The image carries a HEALTHCHECK; give it a moment before reporting.
        sleep 5
        if [[ "$(docker inspect -f '{{.State.Running}}' loxilb-ui 2>/dev/null)" == "true" ]]; then
            show_urls
            info "Logs: $0 $MODE logs    Stop: $0 $MODE down"
        else
            error "Container is not running. Recent logs:"
            compose logs --tail 50
            exit 1
        fi
        ;;
    down)    info "Stopping loxilb-ui..."; compose down; success "Stopped" ;;
    restart) compose restart; show_urls ;;
    logs)    compose logs -f ;;
    status)  compose ps ;;
    *) error "Invalid action: $ACTION"; usage; exit 1 ;;
esac
