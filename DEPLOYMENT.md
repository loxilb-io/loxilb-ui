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

> **Image reference:** what the image contains, its full environment surface,
> how to verify its signature, and how to build your own —
> [docs/container-image.md](docs/container-image.md).

## Configuration reference

The SPA reaches the backend through a reverse proxy on the same origin
(`/api/oam` → OAM), so the browser makes only same-origin requests. The image is
configured by environment variables at container start:

| Variable | Meaning | Default |
|----------|---------|---------|
| `SSL_MODE` | Edge TLS mode: `disabled` (HTTP), `enabled` (self-signed), `commercial` (operator-provided certs) | `disabled` |
| `BACKEND_URL` | OAM API base the edge proxies `/api/oam` to | *(empty — warns, API calls 502)* |
| `BACKEND_HOST` | `Host` header and TLS SNI presented to the backend | derived from `BACKEND_URL` |
| `BACKEND_TLS_VERIFY` | Verify the backend's certificate chain (`on`/`off`) | `off` |
| `FRONTEND_URL` | Browser-facing origin, forwarded to OAM as `Origin` | `http://localhost:3000` |
| `PUBLIC_PATH` | Path prefix the app is served under (React Router basename) | `/netlox` |
| `HTTP_PORT` / `HTTPS_PORT` | Container listen ports | `8080` / `8443` |
| `HTTPS_REDIRECT_PORT` | Port included in the HTTP→HTTPS redirect when TLS is published on a non-443 port | *(empty)* |

The Compose files supply these; `docker-compose.yml` defaults `SSL_MODE` to
`enabled` so a bare `docker compose up` gives you HTTPS.

An unset or unreachable `BACKEND_URL` does **not** stop the container: it starts,
serves the SPA, and returns `502` for API calls until the backend appears.

For the **unified bundle**, the equivalent knobs are the single Caddy edge pair
`SITE_ADDRESS` / `EDGE_TLS` plus `OAM_UPSTREAM` — see the bundle's `.env.example`.

Build-time / development variables (`.env.development`, `.env.local`) such as
`REACT_APP_API_URL`, `PORT`, and `HTTPS` are documented in the [README](README.md).
Note that `REACT_APP_API_URL` and `REACT_APP_PUBLIC_URL` are inlined into the
bundle by Create React App: they are properties of the image, so changing the
path prefix means rebuilding, not just setting `PUBLIC_PATH`.

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

`docker-compose.yml` runs the published image; each TLS mode is a small overlay
layered on top of it.

```bash
cp .env.example .env         # set BACKEND_URL to your OAM backend

# HTTPS with an auto-generated self-signed certificate (the default)
docker compose up -d
#   → https://localhost:3443/netlox/   (http://localhost:3000 redirects to it)

# HTTP only (e.g. behind your own TLS-terminating reverse proxy)
docker compose -f docker-compose.yml -f docker-compose.http.yml up -d
#   → http://localhost:3000/netlox/

# HTTPS with operator-provided certificates
docker compose -f docker-compose.yml -f docker-compose.commercial.yml up -d

# Build from this checkout instead of pulling a release
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

`./deploy.sh [http|https|commercial] [up|down|restart|logs|status]` wraps the
same overlays.

Configuration comes from `.env` (see [Configuration reference](#configuration-reference)
and `.env.example`); the compose files pass it through:

```env
SSL_MODE=enabled                      # disabled | enabled | commercial
BACKEND_URL=https://oam.example.com:8080
BACKEND_TLS_VERIFY=off
FRONTEND_URL=https://ui.example.com
UI_TAG=v0.9.8.7                       # pin a release; never :latest in production
```

Published host ports: **3000** (HTTP) and **3443** (HTTPS). Inside the
container nginx listens on **8080/8443** — it runs as an unprivileged user
(uid 101) and cannot bind privileged ports. Change the published side freely
(`UI_HTTP_PORT` / `UI_HTTPS_PORT`).

### TLS modes

- **HTTP (`SSL_MODE=disabled`)** — no TLS in the container; terminate it at your
  ingress or load balancer.
- **Self-signed (`SSL_MODE=enabled`, development)** — generated on container
  start. Browsers warn; proceed, or trust the certificate locally. Regenerate
  with `docker exec <container> /usr/local/bin/ssl-setup.sh self-signed` and
  restart.
- **Operator-provided (`SSL_MODE=commercial`, production)** — drop your
  certificate and key in `ssl/`:

  ```bash
  mkdir -p ssl
  cp your-cert.pem ssl/cert.pem && cp your-key.pem ssl/key.pem
  chmod 644 ssl/*.pem     # readable by uid 101 inside the container
  docker compose -f docker-compose.yml -f docker-compose.commercial.yml up -d
  ```

  The container refuses to start if the pair is missing or mismatched rather
  than silently falling back to a self-signed certificate — inspect one with
  `docker exec <container> /usr/local/bin/ssl-setup.sh validate`.

TLS 1.2/1.3 with forward-secret AEAD suites, HSTS on the TLS listener, and
security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP)
are configured in the nginx templates. Both TLS modes include the same shared
`nginx-app.conf.template`, so their routing cannot drift apart.

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
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

Configuration lives entirely in `k8s/configmap.yaml` and is handed to the
container through `envFrom` — the same variables the Compose stack uses. The
pod renders its own nginx configuration at startup, so no nginx config is
embedded in the ConfigMap and there is no init container.

Point `BACKEND_URL` at your OAM Service before applying:

```yaml
BACKEND_URL: "http://loxilb-oam.loxilb-system.svc.cluster.local:8080"
FRONTEND_URL: "https://loxilb-ui.example.com"   # your ingress hostname
```

The pods run as uid 101 with `runAsNonRoot`, all capabilities dropped, and
`allowPrivilegeEscalation: false`; the container ports are 8080/8443 and the
Service maps its own 80/443 onto them by name. The usual choice is
`SSL_MODE=disabled` with TLS terminated at the ingress.

The ingress forwards `/netlox`, `/api/oam` and `/` **without** rewriting the
path — the SPA's assets are root-absolute and its routes are prefixed, so a
`rewrite-target` that strips prefixes yields a blank page.

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

- **Standalone image:** nginx serves `/health` in every TLS mode, never
  redirected — used by the image's own `HEALTHCHECK`, the Compose stack, and the
  Kubernetes liveness/readiness probes.
- **Unified bundle:** the Caddy edge exposes `/healthz`; the OAM API exposes
  `/oam/health`.

`/health` reports only that nginx is serving. It says nothing about the backend
— the login page runs its own OAM preflight and reports an unreachable backend
there.
