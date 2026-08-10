# LoxiLB UI Dashboard

[![Release](https://img.shields.io/github/v/release/loxilb-io/loxilb-ui?label=release&color=blue)](https://github.com/loxilb-io/loxilb-ui/releases/latest)
[![License](https://img.shields.io/badge/license-Apache_2.0-green.svg)](#-license)
[![Docker](https://img.shields.io/badge/docker-supported-blue.svg)](#-docker-deployment)
[![Kubernetes](https://img.shields.io/badge/kubernetes-ready-green.svg)](#-kubernetes-deployment)

A modern React-based web dashboard for efficiently managing LoxiLB load balancers and network services with comprehensive SSL/HTTPS support and multiple deployment options.

> ### ⚠️ Prerequisite: this UI does not run on its own
>
> LoxiLB UI is a **front-end for the [loxilb-oam](https://github.com/loxilb-io/loxilb-oam)
> management API** — it holds no data and performs no logic itself. Every screen
> (login, dashboards, all CRUD) is served by talking to a running **loxilb-oam**
> backend, which in turn drives the LoxiLB core. **Deploying only this container
> gets you a login page that cannot authenticate anyone** — there is nothing
> behind it.
>
> Before you deploy, make sure you have a reachable OAM backend and point the UI
> at it (`BACKEND_URL`, see [Environment Configuration](#-environment-configuration)).
>
> **The recommended way to run the whole management plane** (this UI + OAM + its
> database behind one TLS edge, wired together for you) is the single-node
> Compose bundle in the OAM repo — start there, not here:
> **[loxilb-oam → deploy/compose (operator guide)](https://github.com/loxilb-io/loxilb-oam/blob/main/docs/deployment-compose.md)**.
> Run this repo's container standalone only when you already operate an OAM
> backend elsewhere (see [Standalone container](DEPLOYMENT.md#standalone-ui-container)).

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Docker Deployment](#-docker-deployment)
- [Kubernetes Deployment](#-kubernetes-deployment)
- [SSL/HTTPS Configuration](#-sslhttps-configuration)
- [Development Setup](#-development-setup)
- [Environment Configuration](#-environment-configuration)
- [API Integration](#-api-integration)
- [Build & Scripts](#-build--scripts)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🚀 Features

### Core Functionality
- **Load Balancer Management**: L4/L7 rules across every mode (dnat, onearm, fullnat, dsr, fullproxy) with selects (rr, hash, priority, persist, lc, chwbl), health probes, TLS termination (https / e2ehttps), and frontend mTLS
- **AI Gateway**: model-based routing, weighted CHWBL, KV-cache-aware routing, prefill/decode (P/D) disaggregation, SSE streaming tuning, MCP session routing, plus API-key and per-tenant rate-limit management
- **Networking**: BGP (neighbors, global, policy, defined-sets, apply), BFD, VLAN/VXLAN, routes, FDB, ports, neighbors
- **Security & Traffic**: firewall rules, IP filters, SYN-flood protection, security rate limits, conntrack, mirrors, QoS, SNI certificates, endpoints
- **IPsec VPN**: tunnel and certificate management
- **High Availability**: cluster instance state (cistate) management
- **Instance Snapshots**: back up and restore an instance's configuration via a guided wizard
- **Real-time Monitoring**: live device/service status, Prometheus-backed dashboards and rate cards (MUI X Charts)
- **Multi-language Support**: Korean, English, and Japanese localization
- **Responsive Design**: mobile-first Material-UI layout

### Security & Deployment
- **Role-Based Access Control**: three roles (admin / operator / viewer) with route guards and capability-gated menus and actions
- **Authentication**: JWT-based login with server-side session revocation on logout; unauthorized/expired sessions redirect to login
- **SSL/HTTPS Support**: self-signed and commercial certificates
- **Docker Ready**: multiple compose configurations for different scenarios
- **Kubernetes Native**: production-ready manifests with security contexts
- **Security Headers**: HSTS, CSP, and other security best practices

### Developer Experience
- **TypeScript**: full type safety; API types generated from the vendored gateway/OAM swagger specs, with a connector↔spec mapping guard in CI
- **State Management**: Recoil for global state, TanStack React Query for server state
- **Hot Reload**: fast development with React Scripts (Create React App)
- **Testing**: Vitest unit + backend-contract tests, and a Playwright end-to-end browser suite (see [`docs/E2E_RUNNING.md`](docs/E2E_RUNNING.md))

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
- **Frontend**: React 18, TypeScript 4.9, Material-UI v6
- **State Management**: Recoil, TanStack React Query v5
- **Routing**: React Router v7
- **Styling**: Emotion, MUI System
- **Build Tools**: React Scripts (CRA), Docker, Kubernetes
- **Testing**: Vitest (unit + backend-contract), Playwright (E2E)
- **Internationalization**: i18next (ko / en / ja)

## 🚀 Quick Start

> **Just want a working system? Don't start here.** The recommended production
> deployment (this UI + the [loxilb-oam](https://github.com/loxilb-io/loxilb-oam)
> API + MySQL behind a TLS-terminating edge) is the single-node Docker Compose
> bundle that ships in the loxilb-oam repository — see its step-by-step
> [operator guide](https://github.com/loxilb-io/loxilb-oam/blob/main/docs/deployment-compose.md).
> The options below run **only the UI container** and require an OAM backend you
> already operate — on their own they render a login page that cannot log in.

### Option 1: Standalone UI container (needs an existing OAM backend)
```bash
# Runs the published image — no checkout or build required.
# Point it at your running OAM backend; without a reachable BACKEND_URL the UI
# has nothing to talk to (see the Prerequisite note above and DEPLOYMENT.md).
docker run -d --name loxilb-ui -p 3000:8080 \
  -e SSL_MODE=disabled \
  -e BACKEND_URL=https://your-oam-host:8080 \
  ghcr.io/loxilb-io/loxilb-ui:latest

# Access the application
# http://localhost:3000/netlox/
```

With Compose, for HTTPS and `.env`-driven configuration:

```bash
git clone https://github.com/loxilb-io/loxilb-ui.git && cd loxilb-ui
cp .env.example .env          # set BACKEND_URL
docker compose up -d
# https://localhost:3443/netlox/   (http://localhost:3000 redirects to it)
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

> **Full deployment guide: [DEPLOYMENT.md](DEPLOYMENT.md).** It covers the
> recommended **unified management-plane bundle** (Caddy edge + OAM + database in
> one stack) alongside the standalone Docker and Kubernetes options summarized
> below. For the image itself — contents, environment surface, signature
> verification, building your own — see
> [docs/container-image.md](docs/container-image.md).

The published image is `ghcr.io/loxilb-io/loxilb-ui`, tagged with the release
version (`v0.9.8.7`, in lockstep with `loxilb` and `loxilb-oam`). Pin a version
tag in production; `:latest` is a lab convenience.

### Deployment Options

`docker-compose.yml` runs the published image; each mode is an overlay on it.

#### 1. HTTPS with Self-Signed Certificates (Default)
```bash
cp .env.example .env       # set BACKEND_URL
docker compose up -d
```
- **Access**: https://localhost:3443/netlox/
- **Features**: certificate generated at start, HTTP→HTTPS redirect
- **Best for**: development, testing

#### 2. HTTP Only
```bash
docker compose -f docker-compose.yml -f docker-compose.http.yml up -d
```
- **Access**: http://localhost:3000/netlox/
- **Features**: no TLS in the container — terminate it at your own edge
- **Best for**: behind an ingress or load balancer

#### 3. HTTPS with Commercial Certificates
```bash
mkdir -p ssl
cp your-certificate.pem ssl/cert.pem
cp your-private-key.pem ssl/key.pem
chmod 644 ssl/*.pem        # readable by uid 101 inside the container

docker compose -f docker-compose.yml -f docker-compose.commercial.yml up -d
```
- **Access**: https://localhost:3443/netlox/
- **Features**: your own certificates; the container refuses to start if they
  are missing or mismatched
- **Best for**: production

#### 4. Build from source
```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
# or: make build-image
```

### Docker Configuration

Configuration is read from `.env` at container start — see
[`.env.example`](.env.example) and the
[configuration reference](DEPLOYMENT.md#configuration-reference):

```env
SSL_MODE=enabled                        # disabled | enabled | commercial
BACKEND_URL=https://oam.example.com:8080  # nginx proxies /api/oam/* → $BACKEND_URL/oam/*
BACKEND_TLS_VERIFY=off                  # on, once the backend has a trusted cert
FRONTEND_URL=http://localhost:3000
PUBLIC_PATH=/netlox
UI_TAG=v0.9.8.7                         # pin a release
```

### Port Configuration
- **Port 3000** (host): HTTP access — redirects to HTTPS when TLS is enabled
- **Port 3443** (host): HTTPS access
- Inside the container nginx listens on **8080/8443**: it runs as an
  unprivileged user (uid 101) and cannot bind privileged ports. Publish them
  wherever you like — `-p 80:8080` works fine.

## ☸️ Kubernetes Deployment

### Prerequisites
- Kubernetes 1.20+
- kubectl configured
- Container registry access

### Deploy to Kubernetes

```bash
# Apply all manifests (kustomize — k8s/ contains a kustomization.yaml)
kubectl apply -k k8s/

# Or deploy step by step
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
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
- **Health endpoints** at `/health`
- **Resource limits and requests** configured

### Kustomization Support
```bash
# Use kustomize for environment-specific configurations
kubectl apply -k k8s/
```

## 🔒 SSL/HTTPS Configuration

Set by `SSL_MODE`; full details in
[docs/container-image.md → TLS modes](docs/container-image.md#tls-modes).

### Self-Signed Certificates (`SSL_MODE=enabled`, development)
- **Auto-generated** on container startup (365 days, `CN=localhost`)
- **Browser warnings** are normal — proceed, or trust the certificate locally
- **Regenerate**: `docker exec <container> /usr/local/bin/ssl-setup.sh self-signed`,
  then restart the container

### Commercial Certificates (`SSL_MODE=commercial`, production)
1. **Prepare certificates**:
   ```bash
   mkdir -p ssl
   cp your-certificate.pem ssl/cert.pem
   cp your-private-key.pem ssl/key.pem
   chmod 644 ssl/*.pem      # readable by uid 101 inside the container
   ```

2. **Deploy with your certs**:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.commercial.yml up -d
   ```

   The container refuses to start if the pair is missing or mismatched, rather
   than silently falling back to a self-signed certificate.

### Security Features
- **TLS 1.2/1.3** only, forward-secret AEAD cipher suites
- **HSTS** on the TLS listener (never advertised over plain HTTP)
- **Security headers**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP
- **HTTP→HTTPS redirects** that honour the request's `Host`
- **No wildcard CORS**: the API is proxied same-origin, so CORS never applies

### SSL Management Script
```bash
# Available commands (run against a live container)
docker exec <container> /usr/local/bin/ssl-setup.sh validate    # Check the pair, print details
docker exec <container> /usr/local/bin/ssl-setup.sh self-signed # Regenerate a dev certificate
```

## 💻 Development Setup

### Prerequisites
- Node.js 22.x (matches CI; use `npm ci` for exact locked deps)
- npm
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
npm start          # Start development server (HTTP) against .env.development
npm run build      # Build for local environment
npm test           # Run unit + backend-contract tests (Vitest)
npm run typecheck  # TypeScript check (tsc --noEmit)
npm run e2e        # Run the Playwright E2E suite (needs a live testbed — see docs/E2E_RUNNING.md)
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

See [`.env.example`](.env.example) for the full, annotated list. The build-time
(`REACT_APP_*`) variables the app actually reads:

```env
# OAM API base URL. OAM serves its routes under /oam — the two modes differ by
# one path segment, so mixing them up 404s every request:
#  - Development (npm start): NO proxy runs — use the DIRECT OAM base ending in
#    /oam, e.g. http://<oam-host>:8080/oam   (NOT /api/oam)
#  - Production (deployed edge): keep the same-origin proxied path /api/oam. The
#    edge — Caddy in the recommended loxilb-oam bundle, or nginx in the
#    standalone UI container — rewrites /api/oam/* → <backend>/oam/*
REACT_APP_API_URL=/api/oam

# Public URL prefix the app is served under
REACT_APP_PUBLIC_URL=/netlox

# Environment name: local | production
REACT_APP_ENV=local

# Dev server
PORT=3000                                # Development server port
HTTPS=false                              # npm start pins HTTPS=false; run react-scripts directly to serve HTTPS
```

### Docker Environment Variables

These configure the **standalone UI container** (its built-in nginx edge). The
recommended [loxilb-oam Compose bundle](https://github.com/loxilb-io/loxilb-oam/tree/main/deploy/compose)
does not use these — its Caddy edge is configured with `SITE_ADDRESS` /
`EDGE_TLS` / `OAM_UPSTREAM` instead (see that bundle's `.env.example`). Both
edges expose the same browser path, `/api/oam/*`, and rewrite it to the OAM
`/oam/*` routes.

```env
SSL_MODE=enabled                         # disabled | enabled | commercial
BACKEND_URL=https://oam.example.com:8080 # OAM API base; nginx proxies /api/oam/* → $BACKEND_URL/oam/*
BACKEND_HOST=                            # Host header / SNI; derived from BACKEND_URL when empty
BACKEND_TLS_VERIFY=off                   # on = verify the backend's certificate chain
FRONTEND_URL=http://localhost:3000       # Browser-facing origin, forwarded to OAM as Origin
PUBLIC_PATH=/netlox                      # Path prefix the SPA is served under
HTTP_PORT=8080                           # Container listen ports (not the published ones)
HTTPS_PORT=8443
HTTPS_REDIRECT_PORT=                     # Port to keep in the HTTP→HTTPS redirect (Compose sets 3443)
```

Every value is read at container start. The two build-time exceptions —
`REACT_APP_API_URL` and `REACT_APP_PUBLIC_URL` — are inlined into the JS bundle
by Create React App, so they are properties of the image; changing the path
prefix means rebuilding. Full table:
[docs/container-image.md → Environment surface](docs/container-image.md#environment-surface).

## 🔌 API Integration

### Authentication & Authorization
- **JWT tokens** issued by the OAM login endpoint
- **Server-side session revocation** on logout; expired/unauthorized responses redirect to login
- **RBAC** — the connector gates mutating requests by role (admin / operator / viewer)

### API Structure
```typescript
// Requests target the OAM base, which proxies to the LoxiLB gateway.
const api = {
  baseURL: process.env.REACT_APP_API_URL,   // e.g. /api/oam or https://oam.example.com/oam
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
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
| `npm start` | Start development server (HTTP) |
| `npm run build` | Build for local environment |
| `npm run build:dev` | Build for development environment |
| `npm run build:prod` | Build for production environment |
| `npm test` | Run unit + backend-contract tests (Vitest) |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run e2e` | Playwright end-to-end browser suite (needs a live testbed) |
| `npm run e2e:cicd` | Just the cicd scenario E2E suite (`tests/cicd/**`) |
| `npm run gen:api` | Regenerate API types from `api-spec/*` |
| `npm run api:check-mapping` | Verify every connector call exists in the backend specs |
| `npm run sync:specs` | Re-vendor backend specs from sibling repos |

The API type-safety and backend-compatibility checks above are described in
[`CONTRIBUTING.md`](CONTRIBUTING.md); running the end-to-end browser suite is
covered in [`docs/E2E_RUNNING.md`](docs/E2E_RUNNING.md).

### Build Optimization
- **Code splitting** with React.lazy()
- **Tree shaking** for minimal bundle size
- **Asset optimization** and compression

### Build & Deployment Entry Points
| Command | Purpose |
|---------|---------|
| `make docker-build` | Build the container image, stamped with `package.json`'s version |
| `make build-image` | Same, tagged `loxilb-ui:latest` for local Compose/Kubernetes use |
| `make version` | Print the release this tree builds as |
| `./deploy.sh [http\|https\|commercial] [up\|down\|restart\|logs\|status]` | Drive the standalone Compose stack |
| `k8s/deploy.sh` | Apply the Kubernetes manifests |

## 🔍 Troubleshooting

### Common Issues

#### SSL Certificate Issues
```bash
# Check certificate status
docker exec <container> /usr/local/bin/ssl-setup.sh validate

# Regenerate self-signed certificates
docker exec <container> /usr/local/bin/ssl-setup.sh self-signed
docker compose restart
```

#### API Connection Issues
```bash
# Check container logs — the startup banner prints the resolved BACKEND_URL,
# and warns loudly when it is unset.
docker compose logs loxilb-ui

# API calls returning 502 means the container is up but cannot reach OAM.
# Verify backend connectivity from inside the container ($BACKEND_URL must
# expand inside the container, hence the sh -c):
docker exec <container> sh -c 'curl -fsS "$BACKEND_URL/oam/health"'
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

All changes land through pull requests — direct pushes to `main` are disabled, every PR needs an
approving review from a maintainer (see [.github/CODEOWNERS](.github/CODEOWNERS)) and green CI, and
commits must be [DCO](https://developercertificate.org/)-signed (`git commit -s`). The full policy —
development setup, coding conventions, and the requirements to merge — is in
**[CONTRIBUTING.md](CONTRIBUTING.md)**; project roles and decision-making are in
**[GOVERNANCE.md](GOVERNANCE.md)**.

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
# Type check
npm run typecheck

# Unit + backend-contract tests
npm test

# Verify connector calls map to the vendored backend specs (H4 guard)
npm run api:check-mapping

# End-to-end browser suite (needs a live testbed — see docs/E2E_RUNNING.md)
npm run e2e
```

> These are the same gates CI runs (`.github/workflows/ci.yml`): `typecheck`,
> `gen:api:check`, `api:check-mapping`, `test`, and a production build.

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 📚 Additional Resources

### Documentation
- [Deployment Guide](DEPLOYMENT.md) — Docker, Kubernetes, and the unified management-plane bundle
- [Contributing Guide](CONTRIBUTING.md) — how to build, test, and submit changes (incl. DCO sign-off)
- [Governance](GOVERNANCE.md) — project governance and decision-making
- [Maintainers](MAINTAINERS.md) — current maintainers
- [Code of Conduct](CODE_OF_CONDUCT.md) — community standards
- [Changelog](CHANGELOG.md) — notable changes per release
- [Security Policy](SECURITY.md) — reporting vulnerabilities
- [E2E Test Guide](docs/E2E_RUNNING.md) — running the Playwright browser suite
- [SSL/HTTPS Configuration](#-sslhttps-configuration) — certificate modes (in this README)
- [Kubernetes Manifests](k8s/) — production-ready Kubernetes deployment

### External Resources
- [React Documentation](https://react.dev/)
- [Material-UI Documentation](https://mui.com/)
- [LoxiLB Official Documentation](https://loxilb.io/)
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

---

> **Note**: This dashboard is designed to work with LoxiLB load balancer infrastructure. Ensure your LoxiLB OAM API is accessible and properly configured before deployment.

*For support and questions, please open an issue in the repository or consult the documentation.*