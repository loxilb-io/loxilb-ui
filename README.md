# LoxiLB UI Dashboard

[![Version](https://img.shields.io/badge/version-0.9.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)
[![Docker](https://img.shields.io/badge/docker-supported-blue.svg)](#docker-deployment)
[![Kubernetes](https://img.shields.io/badge/kubernetes-ready-green.svg)](#kubernetes-deployment)

A modern React-based web dashboard for efficiently managing LoxiLB load balancers and network services with comprehensive SSL/HTTPS support and multiple deployment options.

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Docker Deployment](#-docker-deployment)
- [Kubernetes Deployment](#-kubernetes-deployment)
- [SSL/HTTPS Configuration](#-ssl-https-configuration)
- [Development Setup](#-development-setup)
- [Environment Configuration](#-environment-configuration)
- [API Integration](#-api-integration)
- [Build & Scripts](#-build--scripts)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🚀 Features

### Core Functionality
- **LoxiLB Management**: Comprehensive load balancer configuration and monitoring
- **Real-time Monitoring**: Live network service and device status tracking
- **Statistics & Visualization**: Advanced charts and metrics using MUI X Charts
- **Multi-language Support**: Korean, English, and Japanese localization
- **Responsive Design**: Mobile-first approach with Material-UI components

### Security & Deployment
- **SSL/HTTPS Support**: Self-signed and commercial certificates
- **Docker Ready**: Multiple compose configurations for different scenarios
- **Kubernetes Native**: Production-ready manifests with security contexts
- **Authentication**: JWT-based authentication with automatic token refresh
- **Security Headers**: HSTS, CSP, and other security best practices

### Developer Experience
- **TypeScript**: Full type safety with modern React patterns
- **State Management**: Recoil for global state, React Query for server state
- **Hot Reload**: Fast development with React Scripts
- **Code Quality**: ESLint, Prettier, and TypeScript integration

## 🏗 Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Frontend (React)  │────│   LoxiLB API (OAM)  │────│   LoxiLB Core       │
│   • Material-UI     │    │   • REST API        │    │   • Load Balancer   │
│   • TypeScript      │    │   • Authentication  │    │   • Network Services│
│   • State Management│    │   • Real-time Data  │    │   • BGP/Firewall    │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### Tech Stack
- **Frontend**: React 18, TypeScript 4.9+, Material-UI v6
- **State Management**: Recoil, Tanstack React Query v5
- **Routing**: React Router v7
- **Styling**: Emotion, MUI System
- **Build Tools**: React Scripts, Docker, Kubernetes
- **Internationalization**: i18next

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd loxilb-ui

# Start with HTTPS (self-signed certificates)
docker-compose up --build -d

# Access the application
# HTTP: http://localhost:3000 (redirects to HTTPS)
# HTTPS: https://localhost:3443
```

### Option 2: Local Development
```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm start
```

## 🐳 Docker Deployment

### Deployment Options

#### 1. HTTPS with Self-Signed Certificates (Default)
```bash
docker-compose up --build -d
```
- **Access**: https://localhost:3443
- **Features**: Auto-generated SSL certificates, HTTP→HTTPS redirect
- **Best for**: Development, testing

#### 2. HTTP Only
```bash
docker-compose -f docker-compose.http.yml up --build -d
```
- **Access**: http://localhost:3000
- **Features**: No SSL overhead
- **Best for**: Local development, reverse proxy setups

#### 3. HTTPS with Commercial Certificates
```bash
# Create SSL directory and add certificates
mkdir -p ssl
cp your-certificate.pem ssl/cert.pem
cp your-private-key.pem ssl/key.pem

# Deploy with commercial certificates
docker-compose -f docker-compose.commercial.yml up --build -d
```
- **Access**: https://localhost:3443
- **Features**: Production-grade SSL certificates
- **Best for**: Production deployment

### Docker Configuration

The application supports multiple environment variables:

```yaml
environment:
  - SSL_MODE=enabled          # enabled|disabled|commercial
  - BACKEND_URL=https://oam.example.com
  - BACKEND_HOST=oam.example.com
  - FRONTEND_URL=http://localhost:3000
  - PUBLIC_PATH=/netlox
```

### Port Configuration
- **Port 3000**: HTTP access (redirects to HTTPS when SSL enabled)
- **Port 3443**: HTTPS access (SSL enabled modes only)

## ☸️ Kubernetes Deployment

### Prerequisites
- Kubernetes 1.20+
- kubectl configured
- Container registry access

### Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Or deploy step by step
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### Kubernetes Features

#### High Availability
- **3 replicas** with rolling updates
- **Pod Disruption Budget** for availability during maintenance
- **Health checks** (liveness and readiness probes)

#### Security
- **Security contexts** with non-root user
- **Read-only root filesystem** where possible
- **Capability dropping** for minimal privileges
- **Network policies** (optional)

#### SSL Certificate Management
```bash
# Generate TLS secret for ingress
./k8s/generate-tls-secret.sh

# Or manually create with your certificates
kubectl create secret tls loxilb-ui-tls \
  --cert=your-cert.pem \
  --key=your-key.pem \
  -n loxilb-system
```

#### Monitoring Integration
- **Prometheus annotations** for metrics scraping
- **Health endpoints** at `/health`
- **Resource limits and requests** configured

### Kustomization Support
```bash
# Use kustomize for environment-specific configurations
kubectl apply -k k8s/
```

## 🔒 SSL/HTTPS Configuration

### Self-Signed Certificates (Development)
- **Auto-generated** on container startup
- **Browser warnings** are normal - click "Proceed to unsafe"
- **Regenerate**: `docker exec <container> /usr/local/bin/ssl-setup.sh self-signed`

### Commercial Certificates (Production)
1. **Prepare certificates**:
   ```bash
   mkdir -p ssl
   cp your-certificate.pem ssl/cert.pem
   cp your-private-key.pem ssl/key.pem
   chmod 644 ssl/cert.pem
   chmod 600 ssl/key.pem
   ```

2. **Deploy with commercial certs**:
   ```bash
   docker-compose -f docker-compose.commercial.yml up --build -d
   ```

### Security Features
- **TLS 1.2/1.3** support
- **Modern cipher suites**
- **HSTS headers** (HTTP Strict Transport Security)
- **Security headers**: X-Frame-Options, CSP, X-XSS-Protection
- **HTTP→HTTPS redirects**

### SSL Management Script
```bash
# Available commands
docker exec <container> /usr/local/bin/ssl-setup.sh auto        # Auto-detect setup
docker exec <container> /usr/local/bin/ssl-setup.sh self-signed # Generate self-signed
docker exec <container> /usr/local/bin/ssl-setup.sh commercial  # Use commercial certs
docker exec <container> /usr/local/bin/ssl-setup.sh validate    # Validate certificates
```

## 💻 Development Setup

### Prerequisites
- Node.js 16+
- npm or yarn
- Git

### Installation
```bash
git clone <repository-url>
cd loxilb-ui
npm install
```

### Environment Setup
```bash
# Copy example environment file
cp .env.example .env.local

# Edit with your configuration
vim .env.local
```

### Development Scripts
```bash
npm start        # Start development server with HTTPS
npm run build    # Build for local environment
npm test         # Run tests (when implemented)
```

### Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── input/          # Form components
│   ├── table/          # Data grid components  
│   ├── modal/          # Dialog components
│   └── layout/         # Layout components
├── pages/              # Route-based page components
├── hooks/              # Custom React hooks
├── connector/          # API integration layer
├── types/              # TypeScript type definitions
├── locales/            # Internationalization
└── assets/             # Static assets
```

### Code Style Guidelines
- **Components**: PascalCase.tsx
- **Hooks**: camelCase.ts with `use` prefix
- **Types**: Interfaces start with `I` prefix
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE

## ⚙️ Environment Configuration

### Environment Files
- `.env.local` - Local development
- `.env.development` - Development environment  
- `.env.production` - Production environment

### Key Variables
```env
# API Configuration
REACT_APP_API_BASE_URL=/api              # API path prefix
BACKEND_URL=http://localhost:8080        # Backend server URL

# Frontend Configuration  
REACT_APP_PUBLIC_URL=/netlox             # Public URL prefix
REACT_APP_ENV=local                      # Environment type

# Development
PORT=3000                                # Development server port
HTTPS=true                               # Enable HTTPS in development
```

### Docker Environment Variables
```env
SSL_MODE=enabled                         # SSL configuration mode
BACKEND_URL=https://oam.example.com     # LoxiLB OAM API URL
BACKEND_HOST=oam.example.com            # Backend host for proxy
FRONTEND_URL=http://localhost:3000       # Frontend URL
PUBLIC_PATH=/netlox                      # Public path prefix
```

## 🔌 API Integration

### Authentication
- **JWT tokens** stored in localStorage
- **Automatic refresh** on token expiry
- **Redirect to login** on unauthorized access

### API Structure
```typescript
// Base API configuration
const api = {
  baseURL: process.env.REACT_APP_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
}
```

### Error Handling
- **Global error interceptor**
- **User-friendly error messages**
- **Automatic retry** for network failures
- **Loading states** with React Query

## 🛠 Build & Scripts

### Available Scripts
| Command | Description |
|---------|-------------|
| `npm start` | Start development server with HTTPS |
| `npm run build` | Build for local environment |
| `npm run build:dev` | Build for development environment |
| `npm run build:prod` | Build for production environment |
| `npm test` | Run unit + backend-contract tests (Vitest) |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run gen:api` | Regenerate API types from `api-spec/*` |
| `npm run api:check-mapping` | Verify every connector call exists in the backend specs |
| `npm run sync:specs` | Re-vendor backend specs from sibling repos |

API type-safety and backend-compatibility tooling is documented in
[`docs/API_TOOLING.md`](docs/API_TOOLING.md); UI-vs-API gap analysis in
[`docs/API_COVERAGE_REPORT.md`](docs/API_COVERAGE_REPORT.md).

### Build Optimization
- **Code splitting** with React.lazy()
- **Bundle analysis** with webpack-bundle-analyzer
- **Tree shaking** for minimal bundle size
- **Asset optimization** and compression

### Deployment Scripts
- `deploy.sh` - Shell deployment script
- `deploy.ps1` - PowerShell deployment script  
- `make-package.ps1` - Create release package

## 🔍 Troubleshooting

### Common Issues

#### SSL Certificate Issues
```bash
# Check certificate status
docker exec <container> /usr/local/bin/ssl-setup.sh validate

# Regenerate self-signed certificates
docker exec <container> /usr/local/bin/ssl-setup.sh self-signed
docker-compose restart
```

#### API Connection Issues
```bash
# Check container logs
docker-compose logs loxilb-ui

# Verify backend connectivity
docker exec <container> curl -k https://oam.example.com/health
```

#### Build Issues
```bash
# Clear and reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npx tsc --noEmit
```

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# HTTPS health (with self-signed cert)
curl -k https://localhost:3443/health
```

### Development Debugging
- **React Developer Tools** - Component tree inspection
- **React Query DevTools** - Server state debugging  
- **Browser Console** - JavaScript errors and network issues
- **Network Tab** - API request/response analysis

## 🤝 Contributing

### Development Workflow
1. **Fork** the repository
2. **Create feature branch**: `git checkout -b feature/description`
3. **Make changes** following code guidelines
4. **Test thoroughly** across different environments
5. **Submit pull request** with clear description

### Commit Message Format
```
feat: add load balancer SSL termination
fix: resolve authentication token expiry issue  
docs: update deployment documentation
style: fix code formatting issues
refactor: improve component architecture
test: add unit tests for SSL configuration
```

### Code Review Checklist
- [ ] Code follows TypeScript and React best practices
- [ ] Components are properly typed
- [ ] Error handling is implemented
- [ ] Responsive design is tested
- [ ] SSL configurations work in all modes
- [ ] Docker and Kubernetes deployments tested

### Testing
```bash
# Run linting
npm run lint

# Run type checking  
npm run type-check

# Run tests (when implemented)
npm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📚 Additional Resources

### Documentation
- [Development Guide](DEVELOPMENT.md) - Comprehensive development documentation
- [SSL Setup Guide](SSL_SETUP_GUIDE.md) - Detailed SSL configuration
- [Kubernetes Manifests](k8s/) - Production-ready Kubernetes deployment

### External Resources
- [React Documentation](https://react.dev/)
- [Material-UI Documentation](https://mui.com/)
- [LoxiLB Official Documentation](https://loxilb.io/)
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

---

> **Note**: This dashboard is designed to work with LoxiLB load balancer infrastructure. Ensure your LoxiLB OAM API is accessible and properly configured before deployment.

*For support and questions, please open an issue in the repository or consult the documentation.*