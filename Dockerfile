# ---- Build stage: compile the React SPA ----
# Node 22 matches the version CI builds and tests with (.github/workflows/*).
FROM node:22-alpine AS builder

WORKDIR /app

# Native module build dependencies (some transitive deps compile from source).
RUN apk add --no-cache python3 make g++

# Install dependencies first so this layer caches on the lockfile alone.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NODE_ENV=production

# Release identifier, shown on the login page and repeated on the OCI label.
# Set by `make docker-build` / the release workflow; an unset build honestly
# reports "dev". package.json is the single source of truth for the number —
# the Makefile derives VERSION from it and the release workflow checks that the
# git tag agrees.
ARG VERSION=dev
ENV REACT_APP_VERSION=${VERSION}

# Build-time SPA config baked in by Create React App (it reads REACT_APP_* from
# the environment). These MUST be set at build time; the app has no runtime
# config, so an unset value ships a broken bundle. Historically they were only
# provided by a developer's local .env.local — which is (correctly) excluded
# from the image — so the defaults below are the source of truth for releases.
#
#   REACT_APP_API_URL    — OAM API base. Relative path the edge proxies to OAM
#                          (Caddy in the loxilb-oam bundle, this image's own
#                          nginx when standalone); works on any host/scheme.
#                          Override to https://oam.host/oam only for a non-edge
#                          topology where the browser calls OAM directly.
#   REACT_APP_PUBLIC_URL  — React Router basename. The app is served under this
#                          prefix (Caddy/nginx both mount it at /netlox); an
#                          empty value 404s every route. It must match the
#                          PUBLIC_PATH the container runs with.
ARG REACT_APP_API_URL=/api/oam
ARG REACT_APP_PUBLIC_URL=/netlox
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_PUBLIC_URL=${REACT_APP_PUBLIC_URL}
# CSP: the served pages must need no inline <script> — the certified policy has
# no script-src 'unsafe-inline', so an inlined CRA runtime chunk would blank
# every page. Kept in sync with .env.production (CI has an agreement gate);
# stated here as well because a build could otherwise silently regress if the
# dotenv file went missing (dotenv-cli proceeds without it).
ENV INLINE_RUNTIME_CHUNK=false
# No source maps in release images.
ENV GENERATE_SOURCEMAP=false
RUN npm run build:prod

# ---- Runtime stage: serve the built SPA with nginx ----
# Pinned to a minor tag so a rebuild cannot silently jump nginx versions.
FROM nginx:1.29-alpine

# openssl   — self-signed certificate generation (SSL_MODE=enabled)
# gettext   — envsubst, which renders the config templates
# curl      — HEALTHCHECK
# ca-certs  — verifying the OAM backend's chain when BACKEND_TLS_VERIFY=on
RUN apk add --no-cache openssl gettext curl ca-certificates

# The stock config serves the nginx welcome page on :80; ours replaces it.
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/nginx.conf

# Templates, rendered into /etc/nginx/conf.d and /etc/nginx/snippets at start
# by the entrypoint. app.conf.template holds the routing both TLS modes share.
COPY nginx-app.conf.template   /etc/nginx/templates/app.conf.template
COPY nginx-http.conf.template  /etc/nginx/templates/http.conf.template
COPY nginx-https.conf.template /etc/nginx/templates/https.conf.template

# Security headers (incl. the CSP). Not a template — nothing to substitute —
# so it is copied straight to where the rendered configs include it from.
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf

COPY ssl-setup.sh /usr/local/bin/ssl-setup.sh
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /usr/local/bin/ssl-setup.sh /docker-entrypoint.sh

COPY --from=builder /app/build /usr/share/nginx/html

# The container runs as the unprivileged `nginx` user (uid 101), so every path
# it writes at startup — rendered config, generated certificates, the pid file —
# must belong to that user.
RUN mkdir -p /etc/nginx/ssl /etc/nginx/snippets \
    && touch /etc/nginx/resolver.conf \
    && chown -R nginx:nginx /etc/nginx /usr/share/nginx/html /var/cache/nginx

ARG VERSION=dev
# Reported by the entrypoint's startup banner, so `docker logs` shows which
# release is running even when the login page is not reachable.
ENV LOXILB_UI_VERSION=${VERSION}

LABEL org.opencontainers.image.title="loxilb-ui" \
      org.opencontainers.image.description="LoxiLB UI — web console for the LoxiLB management plane" \
      org.opencontainers.image.source="https://github.com/loxilb-io/loxilb-ui" \
      org.opencontainers.image.url="https://github.com/loxilb-io/loxilb-ui" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="${VERSION}"

# Runtime configuration. Defaults are duplicated in docker-entrypoint.sh so the
# container behaves the same when these are unset; keep the two in sync.
#
# BACKEND_URL is deliberately empty rather than a plausible-looking placeholder:
# the container must boot and serve the SPA with no backend configured, and the
# entrypoint turns an empty value into a loud warning plus an unreachable
# upstream, so API calls fail as an honest 502.
ENV SSL_MODE="disabled" \
    BACKEND_URL="" \
    FRONTEND_URL="http://localhost:3000" \
    PUBLIC_PATH="/netlox" \
    BACKEND_TLS_VERIFY="off" \
    HTTP_PORT="8080" \
    HTTPS_PORT="8443"

USER nginx

# Unprivileged ports: binding 80/443 would need CAP_NET_BIND_SERVICE, which a
# non-root container should not carry. Publish them wherever you like
# (`-p 80:8080`) — the container's own numbers do not constrain the host's.
EXPOSE 8080 8443

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -fsS "http://localhost:${HTTP_PORT}/health" || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
