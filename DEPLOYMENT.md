# LoxiLB UI Deployment Guide

LoxiLB UI is a static single-page application (SPA). It ships as a container
image that can be deployed two ways:

1. **Unified management-plane bundle (recommended for production).** The UI is
   served by a Caddy edge alongside the OAM API and its database, from a single
   Docker Compose (or Kubernetes) stack. This is the way to run the whole LoxiLB
   management plane on one host or cluster. See [Unified bundle](#unified-management-plane-bundle).
2. **Standalone UI container.** Just the SPA, served by its own nginx, proxying
   `/api/oam` to an OAM backend you already run. Useful for development, for
   putting the UI behind your own ingress, or when OAM lives elsewhere. See
   [Standalone container](#standalone-ui-container).

Both use the same image; only who terminates TLS and routes traffic differs.

## Table of Contents

- [Configuration reference](#configuration-reference)
- [Unified management-plane bundle](#unified-management-plane-bundle)
- [Standalone UI container](#standalone-ui-container)
  - [Docker Compose](#docker-compose)
  - [TLS modes](#tls-modes)
  - [Kubernetes](#kubernetes)
- [Health checks](#health-checks)

## Configuration reference

The SPA reaches the backend through a reverse proxy on the same origin
(`/api/oam` → OAM), so the browser makes only same-origin requests. The image is
configured by environment variables at container start:

| Variable | Meaning | Default |
|----------|---------|---------|
| `SSL_MODE` | Edge TLS mode: `enabled` (self-signed), `disabled` (HTTP), `commercial` (operator-provided certs) | `enabled` |
| `BACKEND_URL` | OAM API base the edge proxies `/api/oam` to | — |
| `BACKEND_HOST` | Backend host used in the proxy config | — |
| `FRONTEND_URL` | Public URL of the UI (used for redirects/CORS) | `http://localhost:3000` |
| `PUBLIC_PATH` | Path prefix the app is served under (React Router basename) | `/netlox` |

For the **unified bundle**, the equivalent knobs are the single Caddy edge pair
`SITE_ADDRESS` / `EDGE_TLS` plus `OAM_UPSTREAM` — see the bundle's `.env.example`.

Build-time / development variables (`.env.development`, `.env.local`) such as
`REACT_APP_API_URL`, `PORT`, and `HTTPS` are documented in the [README](README.md).

## Unified management-plane bundle

The production-recommended path runs **Caddy (edge) + oam-loxilb (API) + MySQL**
as one stack, with the UI SPA served by Caddy. It lives in the OAM repository so
the database schema and the Kubernetes overlays stay single-sourced:

> **[`loxilb-io/loxilb-oam` → `deploy/compose/`](https://github.com/loxilb-io/loxilb-oam/tree/main/deploy/compose)**

Quick start (from that directory):

```bash
cp .env.example .env        # fill in the required secrets
# Development — builds the UI and OAM images from local source checkouts:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
# Production — pinned images, isolated DB network, only the edge is exposed:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Open the UI at `http(s)://<host>/netlox/`. The edge terminates TLS once; a
single `SITE_ADDRESS` / `EDGE_TLS` pair selects HTTP, self-signed HTTPS
(the default for private networks), automatic HTTPS (Let's Encrypt), or an
operator-provided certificate — generate a self-signed edge cert with the
bundled `scripts/generate-edge-certs.sh`. The bundle's `README.md` documents the
full edge-TLS matrix and the OAM↔instance TLS workflow.

Production images (`ghcr.io/loxilb-io/loxilb-ui`) are published by this
repository's [release workflow](.github/workflows/release.yml) on a version tag.

## Standalone UI container

Run only the SPA, pointed at an OAM backend you already operate. The image
serves the built SPA with nginx and reverse-proxies `/api/oam` to `BACKEND_URL`.

### Docker Compose

Three compose files cover the common edge modes:

```bash
# HTTPS with an auto-generated self-signed certificate (default)
docker compose up --build -d
#   → https://localhost:3443  (HTTP on :3000 redirects to HTTPS)

# HTTP only (e.g. behind your own TLS-terminating reverse proxy)
docker compose -f docker-compose.http.yml up --build -d
#   → http://localhost:3000

# HTTPS with operator-provided certificates
docker compose -f docker-compose.https.yml up --build -d
```

Set the backend and TLS mode via environment (in the compose file or an `.env`):

```yaml
environment:
  - SSL_MODE=enabled                    # enabled | disabled | commercial
  - BACKEND_URL=https://oam.example.com
  - BACKEND_HOST=oam.example.com
  - PUBLIC_PATH=/netlox
```

Ports: **3000** (HTTP, redirects to HTTPS when TLS is enabled) and **3443**
(HTTPS).

### TLS modes

- **Self-signed (development)** — generated on container start. Browsers warn;
  proceed, or trust the certificate locally. Regenerate with
  `docker exec <container> /usr/local/bin/ssl-setup.sh self-signed`.
- **Operator-provided (production)** — drop your certificate and key in `ssl/`
  and set `SSL_MODE=commercial`:

  ```bash
  mkdir -p ssl
  cp your-cert.pem ssl/cert.pem   && chmod 644 ssl/cert.pem
  cp your-key.pem  ssl/key.pem    && chmod 600 ssl/key.pem
  docker compose -f docker-compose.https.yml up --build -d
  ```

The bundled `ssl-setup.sh` also exposes `auto`, `commercial`, and `validate`
subcommands. TLS 1.2/1.3, HSTS, and security headers (X-Frame-Options, CSP) are
configured in the nginx templates.

### Kubernetes

Standalone manifests live in [`k8s/`](k8s/): namespace, config/secret,
deployment (3 replicas, rolling updates, liveness/readiness probes), service,
ingress, and a pod disruption budget, wired together with Kustomize.

```bash
# Everything at once
kubectl apply -k k8s/

# Or step by step
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

Provide the ingress TLS certificate with the helper or manually:

```bash
./k8s/generate-tls-secret.sh
# or
kubectl create secret tls loxilb-ui-tls --cert=cert.pem --key=key.pem -n loxilb-system
```

For a full management-plane cluster deployment (UI + OAM + database behind one
edge), prefer the unified bundle's Kubernetes track over these standalone
manifests.

## Health checks

- **Standalone image:** nginx serves `/health` (used by the container and k8s
  probes).
- **Unified bundle:** the Caddy edge exposes `/healthz`; the OAM API exposes
  `/oam/health`.
