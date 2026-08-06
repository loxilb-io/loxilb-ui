# Container Image Reference

Everything about the `loxilb-ui` container image: what is published, how to
verify it, how to run it standalone, and how to build your own.

> **Looking for a deployment guide, not an image reference?** Use
> [DEPLOYMENT.md](../DEPLOYMENT.md). And note that most deployments should not
> run this image on its own: the full management plane — this UI + the
> [loxilb-oam](https://github.com/loxilb-io/loxilb-oam) API + MySQL behind a
> TLS edge — is the Compose bundle in
> [loxilb-oam → deploy/compose/](https://github.com/loxilb-io/loxilb-oam/blob/main/docs/deployment-compose.md).
> Standalone is for when you already operate an OAM backend elsewhere.

## Table of contents

1. [What is published](#what-is-published)
2. [Image contents](#image-contents)
3. [Pull and verify](#pull-and-verify)
4. [Run the image](#run-the-image)
5. [Environment surface](#environment-surface)
6. [How the image serves the SPA](#how-the-image-serves-the-spa)
7. [TLS modes](#tls-modes)
8. [Build your own image](#build-your-own-image)
9. [Air-gapped and mirrored registries](#air-gapped-and-mirrored-registries)
10. [Operating a running container](#operating-a-running-container)
11. [Supply-chain pipeline](#supply-chain-pipeline)
12. [Known limitations](#known-limitations)

## What is published

| | |
|---|---|
| Registry | `ghcr.io/loxilb-io/loxilb-ui` |
| Platforms | `linux/amd64` only (no arm64 image is published — see [Known limitations](#known-limitations)) |
| Base | `nginx:1.29-alpine` |
| Published by | `.github/workflows/release.yml`, on a `v*` git tag |

### Tags

Image tags are the release version, which follows
[loxilb-io/loxilb](https://github.com/loxilb-io/loxilb): `vMAJOR.MINOR.PATCH`
with an optional fourth build component. loxilb-ui versions in lockstep with
loxilb and loxilb-oam — pair `loxilb-ui:v0.9.8.7` with `loxilb-oam:v0.9.8.7`.

| Tag form | Meaning |
|----------|---------|
| `v0.9.8.7` | An immutable release. **Use this in production.** |
| `v0.9.8.7-rc.1`, `-alpha.`, `-beta.` | Prerelease. Published, but does **not** move `:latest`. |
| `latest` | The most recent *final* release. Convenient for a lab; untraceable for an upgrade — never pin production to it. |

Publishing is gated: the release job targets the `release` GitHub Environment,
so a pushed tag alone cannot ship an image — a required reviewer must approve
it, and a Trivy CRITICAL+fixable scan must pass *before* the push. The workflow
also refuses to publish a tag that disagrees with the version in `package.json`.

## Image contents

```
/usr/share/nginx/html/          the built SPA (Create React App output)
/etc/nginx/nginx.conf           base configuration
/etc/nginx/templates/           app.conf / http.conf / https.conf templates
/etc/nginx/conf.d/default.conf  rendered at startup from the templates
/etc/nginx/ssl/                 certificates (generated or mounted)
/docker-entrypoint.sh           renders the config, then execs nginx
/usr/local/bin/ssl-setup.sh     certificate helper
```

| Aspect | Value |
|--------|-------|
| User | `nginx` (uid 101) — **the image runs unprivileged** |
| Exposed ports | `8080` (HTTP), `8443` (HTTPS) — unprivileged by necessity, see [Known limitations](#known-limitations) |
| Entrypoint | `/docker-entrypoint.sh` — validates the environment, renders nginx config per `SSL_MODE`, execs `nginx -g "daemon off;"` |
| Healthcheck | baked in: `curl -fsS http://localhost:$HTTP_PORT/health` every 30s |
| Logs | nginx access/error logs to stdout/stderr — read with `docker logs`; no log volume needed |
| CA trust | `ca-certificates` installed, for verifying the OAM backend when `BACKEND_TLS_VERIFY=on` |

The image carries OCI labels (`org.opencontainers.image.source`, `.version`,
`.licenses`, …) linking the GHCR package back to this repository.

To confirm which version an image is:

```bash
docker inspect -f '{{index .Config.Labels "org.opencontainers.image.version"}}' \
  ghcr.io/loxilb-io/loxilb-ui:v0.9.8.7
# v0.9.8.7
```

The same number is compiled into the bundle and shown under the logo on the
login page, and the entrypoint prints it at startup:

```bash
docker logs loxilb-ui | head -1
# loxilb-ui v0.9.8.7 — configuring nginx
```

An image built without a `VERSION` build-arg reports `dev` in all three places.

## Pull and verify

```bash
docker pull ghcr.io/loxilb-io/loxilb-ui:v0.9.8.7
```

If the pull returns `unauthorized`, the GHCR package is not public from your
network. Authenticate with a token that has `read:packages`:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <your-github-user> --password-stdin
```

Every published image is Cosign-signed (keyless/OIDC) and carries SLSA
build-provenance and SPDX SBOM attestations. Verify before deploying:

```bash
# 1. Signature — proves the image was built by this repo's release workflow.
cosign verify ghcr.io/loxilb-io/loxilb-ui:v0.9.8.7 \
  --certificate-identity-regexp '^https://github\.com/loxilb-io/loxilb-ui/\.github/workflows/release\.yml@refs/tags/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# 2. Build provenance (SLSA).
gh attestation verify oci://ghcr.io/loxilb-io/loxilb-ui:v0.9.8.7 --owner loxilb-io

# 3. SBOM (SPDX) — also attached to the GitHub Release as sbom.spdx.json.
gh attestation verify oci://ghcr.io/loxilb-io/loxilb-ui:v0.9.8.7 --owner loxilb-io \
  --predicate-type https://spdx.dev/Document
```

Deploy by digest (`...@sha256:…`) rather than tag when your policy requires the
verified artifact and the running artifact to be provably identical.

## Run the image

The UI is a front end for loxilb-oam. It starts and serves the login page with
no backend configured, but cannot log in until `BACKEND_URL` reaches an OAM
instance — the login page says so explicitly when the preflight fails.

```bash
docker run -d --name loxilb-ui \
  -p 3000:8080 \
  -e SSL_MODE=disabled \
  -e BACKEND_URL=https://oam.example.com:8080 \
  -e FRONTEND_URL=http://localhost:3000 \
  ghcr.io/loxilb-io/loxilb-ui:v0.9.8.7
```

Then open <http://localhost:3000/netlox/>.

Verify it is up:

```bash
curl -fsS http://localhost:3000/health     # healthy
```

The container **fails fast** on a configuration it cannot honour — an unknown
`SSL_MODE`, a `PUBLIC_PATH` that is not an absolute path, a `commercial` mode
with no certificates mounted. It exits with a one-line reason rather than
starting in a state that half-works.

It does **not** fail on an unreachable backend: `BACKEND_URL` is resolved per
request, so the container starts, serves the SPA, and returns `502` for API
calls until the backend appears. That matters when the UI and OAM start
together.

The [Compose stack](../docker-compose.yml) wraps the same image with the ports,
overlays, and `.env` handling most deployments want.

## Environment surface

All configuration is read at container start; nothing is baked in except the
two build-time SPA values noted below.

| Variable | Default | Purpose |
|----------|---------|---------|
| `SSL_MODE` | `disabled` | `disabled` \| `enabled` \| `commercial` — see [TLS modes](#tls-modes) |
| `BACKEND_URL` | *(empty)* | OAM API base; `/api/oam/*` is proxied to `${BACKEND_URL}/oam/*`. Empty logs a warning and makes API calls return `502` |
| `BACKEND_HOST` | *(derived from `BACKEND_URL`)* | `Host` header and TLS SNI presented to the backend |
| `BACKEND_TLS_VERIFY` | `off` | `on` \| `off` — verify the backend's certificate chain |
| `FRONTEND_URL` | `http://localhost:3000` | Browser-facing origin, forwarded to OAM as `Origin`/`Referer` so it matches OAM's `OAM_ALLOWED_ORIGINS` |
| `PUBLIC_PATH` | `/netlox` | Path prefix the SPA is served under; must match the image's build-time `REACT_APP_PUBLIC_URL` |
| `HTTP_PORT` | `8080` | Container's HTTP listen port |
| `HTTPS_PORT` | `8443` | Container's HTTPS listen port |
| `HTTPS_REDIRECT_PORT` | *(empty)* | Port to include in the HTTP→HTTPS redirect, when TLS is published on a non-443 port (Compose sets `3443`) |

`BACKEND_TLS_VERIFY` defaults to `off` because the common standalone topology
puts OAM behind a self-signed certificate. Turn it on wherever the backend
presents a chain the container can validate — this hop carries session tokens.

**Build-time only** — `REACT_APP_API_URL` (`/api/oam`) and `REACT_APP_PUBLIC_URL`
(`/netlox`) are inlined into the JavaScript bundle by Create React App. They are
properties of the *image*, not of the deployment: serving the SPA under a
different prefix means building a new image, not setting `PUBLIC_PATH` alone.

## How the image serves the SPA

Worth knowing when putting the container behind another proxy, because the
served tree has two shapes at once:

| Path | Served as |
|------|-----------|
| `/static/**` | Content-hashed build assets. Cached `immutable` for a year; a missing one returns **404**, never the SPA shell. |
| `${PUBLIC_PATH}/**` | Client-side routes — any unknown path returns `index.html` so React Router can handle it. |
| `/api/oam/**` | Reverse-proxied to `${BACKEND_URL}/oam/**`. |
| `/health` | Liveness, in every mode, never redirected. |
| `/` and `${PUBLIC_PATH}` | `301` to `${PUBLIC_PATH}/`. |
| anything else | Real root files (`/favicon.ico`, `/manifest.json`, `/robots.txt`), else the SPA shell. |

Create React App emits **root-absolute** asset URLs (`/static/js/main.<hash>.js`)
no matter what the router basename is, which is why assets live at the root
while routes live under the prefix. A proxy in front of this container must
therefore forward `/static`, `/api/oam`, and `${PUBLIC_PATH}` — stripping the
prefix, or forwarding only `${PUBLIC_PATH}`, yields a blank page. This is the
same layout the loxilb-oam bundle's Caddy edge serves.

Responses carry `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
and a `Content-Security-Policy`; HTML is `no-store` so a browser cannot keep
booting a previous bundle after an upgrade. HSTS is added only on the TLS
listener.

No CORS headers are emitted: every request the browser makes is same-origin,
because the API is proxied under the SPA's own hostname.

## TLS modes

| `SSL_MODE` | Behaviour |
|------------|-----------|
| `disabled` | HTTP only on `HTTP_PORT`. For deployments that terminate TLS at an ingress, a cloud load balancer, or their own edge. |
| `enabled` | HTTPS on `HTTPS_PORT` with a self-signed certificate generated at first start (365 days, `CN=localhost`). `HTTP_PORT` serves `/health` and redirects everything else. Browsers will warn — development and lab use. |
| `commercial` | HTTPS with the certificate and key you mount at `/etc/nginx/ssl/{cert.pem,key.pem}`. The container **refuses to start** if they are missing or do not match each other, rather than falling back to a self-signed pair a cert-mounting mistake would make invisible. |

```bash
# Operator-provided certificates
mkdir -p ssl
cp your-cert.pem ssl/cert.pem && cp your-key.pem ssl/key.pem
chmod 644 ssl/*.pem     # readable by uid 101 inside the container
docker run -d --name loxilb-ui \
  -p 3000:8080 -p 3443:8443 \
  -e SSL_MODE=commercial -e HTTPS_REDIRECT_PORT=3443 \
  -v "$PWD/ssl:/etc/nginx/ssl:ro" \
  ghcr.io/loxilb-io/loxilb-ui:v0.9.8.7
```

Certificates persist only as long as the container's writable layer; mount
`/etc/nginx/ssl` if a generated certificate must survive a replacement.

## Build your own image

Forks, air-gapped builds, and patched releases all build from the same
`Dockerfile`. The Makefile wraps it:

```bash
make docker-build                                       # ghcr.io/loxilb-io/loxilb-ui:<package.json version>
make docker-build docker-push VERSION=v0.9.8.7          # build, then push (needs docker login)
make docker-build IMAGE_NAME=myorg/loxilb-ui REGISTRY=docker.io
make build-image                                        # local name: loxilb-ui:latest
```

| Make variable | Default | Purpose |
|---------------|---------|---------|
| `REGISTRY` | `ghcr.io` | registry host |
| `IMAGE_NAME` | `loxilb-io/loxilb-ui` | repository path |
| `VERSION` | `v` + `package.json` version | release identifier — baked into the bundle and the OCI version label |
| `TAG` | `$(VERSION)` | image tag; override alone to name an image without changing the stamped version (e.g. `TAG=latest`) |

Plain Docker, if you would rather not use Make:

```bash
docker build --build-arg VERSION=v0.9.8.7 -t myorg/loxilb-ui:v0.9.8.7 .
```

Serving the SPA under a different prefix, or pointing the bundle straight at an
OAM origin instead of the same-origin proxy, means overriding the build-time
values:

```bash
docker build \
  --build-arg VERSION=v0.9.8.7 \
  --build-arg REACT_APP_PUBLIC_URL=/console \
  --build-arg REACT_APP_API_URL=https://oam.example.com/oam \
  -t myorg/loxilb-ui:console .
# then run it with a matching PUBLIC_PATH=/console
```

What the build does: stage 1 (`node:22-alpine`, the version CI uses) installs
dependencies from the lockfile in their own layer, then runs
`npm run build:prod`. Stage 2 copies only `build/` onto `nginx:1.29-alpine`
along with the config templates and entrypoint — no toolchain, no source.
`.dockerignore` keeps `.git`, `node_modules`, `.env.local`, `e2e/`, `k8s/`, and
markdown out of the build context.

Building for a non-amd64 host:

```bash
docker buildx build --platform linux/arm64 -t myorg/loxilb-ui:v0.9.8.7-arm64 .
```

This is a supported *build* — it is simply not something the project publishes
or tests in CI.

## Air-gapped and mirrored registries

Move the image across the boundary by digest, keeping tags intact:

```bash
# On a connected host
docker pull ghcr.io/loxilb-io/loxilb-ui:v0.9.8.7
docker save ghcr.io/loxilb-io/loxilb-ui:v0.9.8.7 | gzip > loxilb-ui-v0.9.8.7.tar.gz

# On the air-gapped host
gunzip -c loxilb-ui-v0.9.8.7.tar.gz | docker load
```

To serve it from an internal registry, retag and push, then override the image
name where the deployment reads it — `UI_IMAGE` / `UI_TAG` in this repo's
`.env`, or the same keys in the loxilb-oam bundle's `.env`:

```bash
docker tag ghcr.io/loxilb-io/loxilb-ui:v0.9.8.7 registry.internal/loxilb-ui:v0.9.8.7
docker push registry.internal/loxilb-ui:v0.9.8.7
```

Verify signatures on the connected side — Cosign and `gh attestation` both need
to reach the transparency log and GitHub.

A static bundle is also attached to every GitHub Release
(`loxilb-ui_<version>_static.tar.gz` + `SHA256SUMS`) for deployments that serve
the SPA from an existing web server instead of running a container.

## Operating a running container

```bash
docker logs -f loxilb-ui                                    # startup banner + access logs
docker exec loxilb-ui curl -fsS http://localhost:8080/health
docker exec loxilb-ui /usr/local/bin/ssl-setup.sh validate  # inspect the certificate
docker exec loxilb-ui /usr/local/bin/ssl-setup.sh self-signed   # regenerate, then restart
docker exec -it loxilb-ui sh                                # busybox shell (as uid 101)
```

Upgrading is a pull-and-replace: pull the new tag and recreate the container
with the same environment. The container holds no state — but note that the UI
and the OAM API version in lockstep, so upgrade both together.

## Supply-chain pipeline

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `build-image.yml` | every PR and push to `main`/`feat/**` | Builds the image (proving the Dockerfile works, not just `npm run build`). Runs an **advisory** Trivy scan for HIGH+CRITICAL fixable CVEs — reports, never blocks. No registry push. |
| `release.yml` | `v*` tag, or manual dispatch | Validates the tag against `package.json`, builds the static bundle + image, runs a **blocking** Trivy CRITICAL+fixable gate, pushes to GHCR, Cosign-signs the digest, attests SLSA provenance and an SPDX SBOM, and creates the GitHub Release with a tarball and `SHA256SUMS`. Requires reviewer approval via the `release` Environment. |

## Known limitations

- **`linux/amd64` only.** No multi-arch manifest is published. arm64 users must
  build their own (see above).
- **Listens on 8080/8443, not 80/443.** The container runs as uid 101 and
  carries no `CAP_NET_BIND_SERVICE`, so it cannot bind privileged ports. Publish
  them wherever you like (`-p 80:8080`); only the container-side numbers are
  fixed.
- **The SPA's API base and path prefix are build-time.** `REACT_APP_API_URL` and
  `REACT_APP_PUBLIC_URL` are inlined by Create React App, so changing them
  requires rebuilding the image rather than setting an environment variable.
- **No backend.** The image is the web console only. It needs a reachable
  loxilb-oam instance to do anything beyond rendering the login page.

## Related documents

- [DEPLOYMENT.md](../DEPLOYMENT.md) — deployment guide (unified bundle,
  standalone container, Kubernetes)
- [loxilb-oam → docs/deployment-compose.md](https://github.com/loxilb-io/loxilb-oam/blob/main/docs/deployment-compose.md)
  — the recommended full management-plane deployment
- [loxilb-oam → docs/container-image.md](https://github.com/loxilb-io/loxilb-oam/blob/main/docs/container-image.md)
  — the API half of the same management plane
