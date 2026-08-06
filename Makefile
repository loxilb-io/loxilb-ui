# loxilb-ui — build and packaging entry points.
#
# Mirrors the target names used by loxilb-io/loxilb-oam so the two halves of the
# management plane are driven the same way.

# ── Version ──────────────────────────────────────────────────────────────────
# loxilb-ui versions in lockstep with loxilb-io/loxilb and uses the same
# vMAJOR.MINOR.PATCH.BUILD scheme: loxilb-ui vX ships against loxilb vX and
# loxilb-oam vX.
#
# package.json's `version` field holds that number and is the single source of
# truth: it is what the login page displays, what the image's OCI version label
# carries, and what the release workflow checks the git tag against — so a
# release is bumped in exactly one place. (npm only enforces semver on publish;
# this package is private, so the four-component form is carried verbatim.)
#
#   make version                       # v0.9.8.7
#   make docker-build VERSION=v0.9.8.8 # override for a one-off build
#
# Read with sed rather than node: `make docker-build` must work on a host that
# has Docker but no Node toolchain (the build happens inside the image), and a
# missing node would silently yield the tag "v".
VERSION ?= v$(shell sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1)

# ── Container image (public releases go to GHCR) ─────────────────────────────
# The published image is $(IMAGE):$(TAG). Override any part on the command line:
#   make docker-build VERSION=v0.9.8.8
#   make docker-build IMAGE_NAME=myorg/loxilb-ui REGISTRY=docker.io
#   make docker-build docker-push TAG=latest
REGISTRY   ?= ghcr.io
IMAGE_NAME ?= loxilb-io/loxilb-ui
TAG        ?= $(VERSION)
IMAGE      ?= $(REGISTRY)/$(IMAGE_NAME)

.PHONY: all build test typecheck clean version docker-build docker-push \
	build-image compose-up compose-down compose-logs

all: test build

# Build the production SPA into build/. VERSION is stamped into the bundle so
# the login page reports the same release the image label carries.
build:
	REACT_APP_VERSION=$(VERSION) npm run build:prod

test:
	npm test

typecheck:
	npm run typecheck

clean:
	rm -rf build dist

# Print the version this tree builds as (scripts and CI consume it).
version:
	@echo $(VERSION)

# Build the public container image: $(IMAGE):$(TAG). VERSION is baked into the
# bundle and the OCI version label; TAG only names the image.
docker-build:
	docker build --build-arg VERSION=$(VERSION) -t $(IMAGE):$(TAG) .

# Push the public image. Requires a prior `docker login $(REGISTRY)`
# (for GHCR: a token with write:packages).
docker-push:
	docker push $(IMAGE):$(TAG)

# Build the image under the local name the Compose files and Kubernetes
# manifests fall back to. (Public releases use docker-build / docker-push.)
build-image:
	docker build --build-arg VERSION=$(VERSION) -t loxilb-ui:latest .

# ── Standalone Compose stack ─────────────────────────────────────────────────
# These drive the root docker-compose.yml (the UI container on its own, against
# an OAM backend you already run). The full management plane — UI + API + MySQL
# behind a TLS edge — is the bundle in loxilb-oam's deploy/compose/.
compose-up:
	docker compose up -d

compose-down:
	docker compose down

compose-logs:
	docker compose logs -f
