#!/usr/bin/env bash
# Re-vendors the backend API specs from the sibling source repos and stamps
# api-spec/SOURCES.json with the exact backend versions they came from.
#
# Run this when bumping the supported loxilb-inference-gateway / oam-loxilb
# version, then:
#   npm run gen:api           # regenerate types
#   npm run api:check-mapping # every UI call still declared?
#   npm test                  # contract tests: backward-compat of wire shapes
# Failures after a bump = the new backend is not backward compatible with this
# UI — fix connectors/pages (or the backend) before merging.
set -euo pipefail
cd "$(dirname "$0")/.."

GATEWAY_REPO="${GATEWAY_REPO:-../loxilb-inference-gateway}"
# The OAM checkout is ../loxilb-oam since the repo moved to loxilb-io/loxilb-oam.
# A stale ../oam-loxilb clone may still exist next to it — defaulting to that
# one would silently vendor a spec from before the migration.
OAM_REPO="${OAM_REPO:-../loxilb-oam}"
# Upstream loxilb — vendored so the loxilb ⊆ gateway subset contract test and
# the flavor capability map are generated from the real community spec.
LOXILB_REPO="${LOXILB_REPO:-../loxilb}"

[ -f "$GATEWAY_REPO/api/swagger.yml" ] || { echo "gateway repo not found at $GATEWAY_REPO (set GATEWAY_REPO=...)"; exit 1; }
[ -d "$OAM_REPO" ] || { echo "oam repo not found at $OAM_REPO (set OAM_REPO=...)"; exit 1; }
[ -f "$LOXILB_REPO/api/swagger.yml" ] || { echo "loxilb repo not found at $LOXILB_REPO (set LOXILB_REPO=...)"; exit 1; }

cp "$GATEWAY_REPO/api/swagger.yml" api-spec/gateway-swagger.yml
cp "$GATEWAY_REPO/api/swagger-extras.yml" api-spec/gateway-swagger-extras.yml
cp "$LOXILB_REPO/api/swagger.yml" api-spec/loxilb-swagger.yml

echo "regenerating OAM swagger (swag init) ..."
if command -v swag >/dev/null 2>&1; then
	(cd "$OAM_REPO" && swag init --parseDependency --parseInternal -g main.go -o docs >/dev/null)
else
	echo "  swag not installed — vendoring the existing $OAM_REPO/docs/swagger.json as-is"
fi
cp "$OAM_REPO/docs/swagger.json" api-spec/oam-swagger.json

rev() { git -C "$1" rev-parse --short HEAD 2>/dev/null || echo unknown; }
dirty() { [ -n "$(git -C "$1" status --porcelain 2>/dev/null)" ] && echo true || echo false; }

cat > api-spec/SOURCES.json <<EOF
{
  "vendoredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "gateway": {
    "repo": "loxilb-inference-gateway",
    "path": "api/swagger.yml + api/swagger-extras.yml",
    "commit": "$(rev "$GATEWAY_REPO")",
    "dirty": $(dirty "$GATEWAY_REPO")
  },
  "oam": {
    "repo": "oam-loxilb",
    "path": "docs/swagger.json (swag init)",
    "commit": "$(rev "$OAM_REPO")",
    "dirty": $(dirty "$OAM_REPO")
  },
  "loxilb": {
    "repo": "loxilb",
    "path": "api/swagger.yml",
    "commit": "$(rev "$LOXILB_REPO")",
    "dirty": $(dirty "$LOXILB_REPO")
  }
}
EOF

echo "vendored specs:"
cat api-spec/SOURCES.json
