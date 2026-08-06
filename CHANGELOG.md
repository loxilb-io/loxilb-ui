# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Releases follow [loxilb-io/loxilb](https://github.com/loxilb-io/loxilb)'s
`vMAJOR.MINOR.PATCH[.BUILD]` scheme, in lockstep with the `loxilb` and
`loxilb-oam` release they ship against.

## [Unreleased]

### Added
- Inference-gateway integration: AI-gateway views alongside the classic LoxiLB
  load-balancer management UI.
- Community and governance baseline aligned with the loxilb-io organization
  policy (governance, maintainers, code owners, PR/issue templates, Dependabot).
- `docs/container-image.md` — reference for the published container image:
  contents, environment surface, signature verification, and building your own.
- `Makefile` with `docker-build` / `docker-push` / `build-image` / `version`
  targets, matching loxilb-oam's.
- `SSL_MODE=commercial` is now implemented (it was documented but unhandled).
  It requires mounted certificates and refuses to start without a valid pair,
  rather than falling back to a self-signed certificate.
- `BACKEND_TLS_VERIFY` (`on`/`off`, default `off`) to verify the OAM backend's
  certificate chain, which was previously unconditionally disabled.
- `docker-compose.commercial.yml` (the mode `deploy.sh` referenced but that
  never existed) and `docker-compose.build.yml` for source builds.

### Fixed
- **The container could not start in HTTP mode.** `SSL_MODE=disabled` — the
  entrypoint's own default, and what `docker-compose.http.yml` sets — rendered a
  template that was an HTTPS server block referencing a certificate nothing
  generated, so `nginx -t` failed and the container exited. The HTTP-only and
  TLS configurations are now generated from one shared include and cannot drift
  apart again.
- **The container could not start with the shipped defaults.** nginx resolved
  the `proxy_pass` hostname at config-parse time, so the default
  `oam.example.com` (and any backend whose DNS was not yet up) aborted startup.
  The upstream is now resolved per request: the container starts, serves the
  console, and returns `502` for API calls until the backend appears.
- **The HTTP→HTTPS redirect sent everyone to `https://localhost`.** It used
  `$server_name` against a hardcoded `server_name localhost`; it now honours the
  request's `Host`, with `HTTPS_REDIRECT_PORT` for non-443 published ports.
- **Upstream failures were reported as `404`.** A `50x.html` error page that a
  Create React App build never produces masked every backend `502`.
- **`/netlox` was matched as a bare prefix** next to an `alias`, the classic
  nginx alias-traversal shape. It is now an exact prefix with a trailing slash.
- **The release tarball was built from a nonexistent env file.** `release.yml`
  ran `npm run build`, which reads the gitignored `.env.local`, so the published
  static bundle shipped with an empty `REACT_APP_PUBLIC_URL` and 404'd on every
  route. It now builds with the same values as the image.
- Missing `registry-username`/`registry-password` on the SBOM step, which makes
  syft fall through to an inaccessible container socket on GitHub runners.
- Kubernetes manifests referenced a maintainer's personal Docker Hub image
  rather than the org's published one, embedded two more copies of the nginx
  config that had drifted from the image's, and declared `runAsNonRoot` with
  ports the container could not bind. The deployment now runs
  `ghcr.io/loxilb-io/loxilb-ui` unprivileged, configured entirely through the
  ConfigMap. A hygiene check now fails the build if a personal registry
  namespace reappears.
- The ingress rewrote paths (`rewrite-target: /$2`), which strips the prefixes
  the SPA and its API proxy are served under.

### Changed
- **The container now runs as an unprivileged user (uid 101) and listens on
  8080/8443** instead of 80/443. Published host ports are unchanged (3000/3443);
  a plain `docker run -p 80:80` must become `-p 80:8080`, and Kubernetes
  manifests must target the new container ports.
- **The Compose stack runs the published image by default** instead of building
  from source, with each TLS mode as an overlay layered on `docker-compose.yml`.
  Build from a checkout with `docker-compose.build.yml`.
- **Version is single-sourced from `package.json`** (`0.9.8.7`, the lockstep
  release number). It is baked into the bundle as `REACT_APP_VERSION`, shown on
  the login page, set as the image's OCI version label, and checked against the
  git tag by the release workflow. The login page previously imported
  `package.json` directly, which also embedded the full dependency list in the
  client bundle. A build with no version stamped reports `dev`.
- The image declares an `ENTRYPOINT` rather than a `CMD`, pins its bases
  (`node:22-alpine` — matching CI — and `nginx:1.29-alpine`), carries OCI
  labels, and logs to stdout/stderr rather than expecting a log volume.
- `BACKEND_HOST` is derived from `BACKEND_URL` when unset.
- Wildcard CORS headers were removed from the API proxy: every browser request
  is same-origin, and `Access-Control-Allow-Origin: *` together with
  `Allow-Credentials: true` is rejected by browsers anyway.
- Modernized the TLS suite list (forward-secret AEAD only) and replaced the
  deprecated `listen ... http2` directive.
- `ssl-setup.sh` reduced to `self-signed` and `validate`; its `commercial`
  detection was based on a regex that could not match.
- `deploy.sh` drives the overlays with Compose v2 (`docker compose`).

[Unreleased]: https://github.com/loxilb-io/loxilb-ui/commits/main
