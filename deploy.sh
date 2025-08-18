#!/bin/bash

# Deployment script for loxilb-ui with SSL support
# Usage: ./deploy.sh [http|https|commercial] [up|down|restart|logs]

set -e

# Default values
MODE="${1:-https}"
ACTION="${2:-up}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [mode] [action]"
    echo ""
    echo "Modes:"
    echo "  http        - HTTP only (no SSL)"
    echo "  https       - HTTPS with self-signed certificates (default)"
    echo "  commercial  - HTTPS with commercial certificates"
    echo ""
    echo "Actions:"
    echo "  up          - Start services (default)"
    echo "  down        - Stop services"
    echo "  restart     - Restart services"
    echo "  logs        - Show logs"
    echo "  status      - Show status"
    echo ""
    echo "Examples:"
    echo "  $0                    # Start with HTTPS (self-signed)"
    echo "  $0 http               # Start with HTTP only"
    echo "  $0 commercial up      # Start with commercial certificates"
    echo "  $0 https restart      # Restart HTTPS service"
    echo "  $0 https logs         # Show logs"
}

# Function to validate commercial certificates
validate_commercial_certs() {
    if [[ ! -d "ssl" ]]; then
        print_error "SSL directory not found. Creating it..."
        mkdir -p ssl
        return 1
    fi
    
    if [[ ! -f "ssl/cert.pem" ]] || [[ ! -f "ssl/key.pem" ]]; then
        print_error "Commercial certificates not found in ssl/ directory"
        print_info "Please place your certificates:"
        print_info "  ssl/cert.pem - Your SSL certificate"
        print_info "  ssl/key.pem  - Your private key"
        return 1
    fi
    
    print_success "Commercial certificates found"
    return 0
}

# Function to determine compose file
get_compose_file() {
    case "$MODE" in
        "http")
            echo "docker-compose.http.yml"
            ;;
        "https")
            echo "docker-compose.https.yml"
            ;;
        "commercial")
            echo "docker-compose.commercial.yml"
            ;;
        *)
            print_error "Invalid mode: $MODE"
            show_usage
            exit 1
            ;;
    esac
}

# Function to show service URLs
show_urls() {
    case "$MODE" in
        "http")
            print_success "Application is running in HTTP mode:"
            print_info "  HTTP: http://localhost:3000"
            ;;
        "https"|"commercial")
            print_success "Application is running in HTTPS mode:"
            print_info "  HTTP:  http://localhost:3000  (redirects to HTTPS)"
            print_info "  HTTPS: https://localhost:3443"
            if [[ "$MODE" == "https" ]]; then
                print_warning "Using self-signed certificates - browser will show security warning"
            fi
            ;;
    esac
}

# Function to perform actions
perform_action() {
    local compose_file=$(get_compose_file)
    
    case "$ACTION" in
        "up")
            print_info "Starting loxilb-ui in $MODE mode..."
            
            # Validate commercial certificates if needed
            if [[ "$MODE" == "commercial" ]]; then
                if ! validate_commercial_certs; then
                    print_error "Cannot start in commercial mode without valid certificates"
                    exit 1
                fi
            fi
            
            # Stop any existing containers
            docker-compose down 2>/dev/null || true
            
            # Start services
            docker-compose -f "$compose_file" up --build -d
            
            # Wait a bit for services to start
            sleep 5
            
            # Check if services are running
            if docker-compose -f "$compose_file" ps | grep -q "Up"; then
                show_urls
                print_info "Use '$0 $MODE logs' to view logs"
                print_info "Use '$0 $MODE down' to stop services"
            else
                print_error "Failed to start services. Check logs:"
                docker-compose -f "$compose_file" logs
                exit 1
            fi
            ;;
        "down")
            print_info "Stopping loxilb-ui services..."
            docker-compose down
            print_success "Services stopped"
            ;;
        "restart")
            print_info "Restarting loxilb-ui in $MODE mode..."
            docker-compose down
            sleep 2
            perform_action "up"
            ;;
        "logs")
            print_info "Showing logs for $MODE mode..."
            docker-compose -f "$(get_compose_file)" logs -f
            ;;
        "status")
            print_info "Service status:"
            docker-compose ps
            ;;
        *)
            print_error "Invalid action: $ACTION"
            show_usage
            exit 1
            ;;
    esac
}

# Main execution
main() {
    print_info "loxilb-ui Deployment Script"
    print_info "Mode: $MODE, Action: $ACTION"
    echo ""
    
    # Check if help is requested
    if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # Check if Docker and Docker Compose are available
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Perform the requested action
    perform_action
}

# Run main function
main "$@"
