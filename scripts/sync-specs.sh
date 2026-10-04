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
#
# Usage:
#   sync-specs.sh                 # full re-vendor: gateway + loxilb + oam
#   sync-specs.sh --only gateway  # gateway specs + SOURCES.json gateway entry
#                                 # only; oam/loxilb files and provenance are
#                                 # left byte-for-byte untouched. Requires the
#                                 # gateway checkout to be CLEAN and DETACHED
#                                 # (pin the exact merge SHA with
#                                 # `git worktree add --detach <dir> <sha>`) so
#                                 # the recorded commit is immutable truth.
#   sync-specs.sh --only oam      # OAM Swagger + provenance only; requires a
#                                 # clean detached OAM checkout and never runs swag.
#   sync-specs.sh --only manifest # gateway metric manifest
#                                 # (deploy/monitoring/manifest/) + its
#                                 # SOURCES.json entry only, same immutable-
#                                 # input gate as --only gateway. Follow with
#                                 # `npm run gen:api` so the UI envelope in
#                                 # src/api/gen/ is regenerated from the new
#                                 # provenance.
set -euo pipefail
if [[ "${1:-}" == "--model" || "${1:-}" == "--gateway-repo" || "${1:-}" == "--gateway-revision" || "${1:-}" == "--oam-repo" || "${1:-}" == "--oam-revision" ]]; then
  exec node "$(dirname "$0")/sync-specs.mjs" "$@"
fi
cd "$(dirname "$0")/.."

ONLY="${1:-}"
if [ -n "$ONLY" ]; then
	[ "$ONLY" = "--only" ] && { [ "${2:-}" = "gateway" ] || [ "${2:-}" = "manifest" ] || [ "${2:-}" = "oam" ]; } || {
		echo "usage: $0 [--only gateway|--only manifest|--only oam]" >&2; exit 2; }
	ONLY="${2}"
fi

GATEWAY_REPO="${GATEWAY_REPO:-../loxilb-inference-gateway}"
# The OAM checkout is ../loxilb-oam since the repo moved to loxilb-io/loxilb-oam.
# A stale ../oam-loxilb clone may still exist next to it — defaulting to that
# one would silently vendor a spec from before the migration.
OAM_REPO="${OAM_REPO:-../loxilb-oam}"
# Upstream loxilb — vendored so the loxilb ⊆ gateway subset contract test and
# the flavor capability map are generated from the real community spec.
LOXILB_REPO="${LOXILB_REPO:-../loxilb}"

MANIFEST_SRC="deploy/monitoring/manifest/metric-manifest.json"

rev() { git -C "$1" rev-parse HEAD 2>/dev/null || echo unknown; }
dirty() { [ -n "$(git -C "$1" status --porcelain 2>/dev/null)" ] && echo true || echo false; }

if [ "$ONLY" = "oam" ]; then
	[ -f "$OAM_REPO/docs/swagger.json" ] || {
		echo "OAM swagger not found at $OAM_REPO/docs/swagger.json" >&2; exit 1; }
	git -C "$OAM_REPO" rev-parse --verify HEAD >/dev/null 2>&1 || {
		echo "refusing --only oam: OAM input has no committed revision" >&2; exit 1; }
	[ "$(dirty "$OAM_REPO")" = "false" ] || {
		echo "refusing --only oam: $OAM_REPO working tree is dirty" >&2; exit 1; }
	git -C "$OAM_REPO" symbolic-ref -q HEAD >/dev/null && {
		echo "refusing --only oam: $OAM_REPO is on a branch, not a detached SHA" >&2; exit 1; }
	git -C "$OAM_REPO" cat-file -e HEAD:docs/swagger.json || {
		echo "refusing --only oam: Swagger is not part of the committed source" >&2; exit 1; }
	git -C "$OAM_REPO" show HEAD:docs/swagger.json > api-spec/oam-swagger.json
	OAM_SHA="$(rev "$OAM_REPO")" node - <<'EOF'
const fs = require('fs');
const p = 'api-spec/SOURCES.json';
const s = JSON.parse(fs.readFileSync(p, 'utf8'));
const crypto = require('crypto');
s.oam = {
	repository: 'https://github.com/loxilb-io/loxilb-oam',
	readMode: 'immutable-git-blobs',
	sha256: {'oam-swagger.json': crypto.createHash('sha256').update(fs.readFileSync('api-spec/oam-swagger.json')).digest('hex')},
	repo: 'loxilb-oam',
	path: 'docs/swagger.json',
	commit: process.env.OAM_SHA,
	dirty: false,
	note: 'vendored verbatim from a clean detached checkout; no source regeneration',
};
fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
EOF
	echo "vendored OAM spec from $(rev "$OAM_REPO"); now run: npm run gen:api"
	exit 0
fi

[ -f "$GATEWAY_REPO/api/swagger.yml" ] || { echo "gateway repo not found at $GATEWAY_REPO (set GATEWAY_REPO=...)"; exit 1; }

# Immutable-input gate shared by the --only modes: a branch head can move and
# a dirty tree has no commit at all, so either would record provenance that is
# not the truth.
require_pinned_gateway() {
	[ "$(dirty "$GATEWAY_REPO")" = "false" ] || {
		echo "refusing --only $ONLY: $GATEWAY_REPO working tree is dirty" >&2; exit 1; }
	git -C "$GATEWAY_REPO" symbolic-ref -q HEAD >/dev/null && {
		echo "refusing --only $ONLY: $GATEWAY_REPO is on a branch, not a detached SHA" >&2
		echo "  pin the input: git -C $GATEWAY_REPO worktree add --detach <dir> <merge-sha>" >&2; exit 1; }
	return 0
}

# Rewrites only the metricManifest entry of SOURCES.json; every other entry
# (including hand-written notes) stays byte-for-byte untouched.
stamp_manifest_entry() {
	GW_SHA="$(rev "$GATEWAY_REPO")" GW_DIRTY="$(dirty "$GATEWAY_REPO")" node - <<'EOF'
const fs = require('fs');
const p = 'api-spec/SOURCES.json';
const s = JSON.parse(fs.readFileSync(p, 'utf8'));
s.metricManifest = {
	repo: 'loxilb-inference-gateway',
	path: 'deploy/monitoring/manifest/metric-manifest.json',
	commit: process.env.GW_SHA,
	dirty: process.env.GW_DIRTY === 'true',
	vendoredAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
	note: 'vendored verbatim (byte-for-byte upstream); the UI version envelope is generated into src/api/gen/metric-manifest.json by scripts/gen-metric-manifest.mjs (npm run gen:api)',
};
fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
EOF
}

if [ "$ONLY" = "manifest" ]; then
	require_pinned_gateway
	[ -f "$GATEWAY_REPO/$MANIFEST_SRC" ] || {
		echo "metric manifest not found at $GATEWAY_REPO/$MANIFEST_SRC" >&2; exit 1; }
	cp "$GATEWAY_REPO/$MANIFEST_SRC" api-spec/metric-manifest.json
	stamp_manifest_entry
	echo "vendored metric manifest from $(rev "$GATEWAY_REPO"); now run: npm run gen:api"
	exit 0
fi

if [ "$ONLY" = "gateway" ]; then
	require_pinned_gateway

	cp "$GATEWAY_REPO/api/swagger.yml" api-spec/gateway-swagger.yml
	cp "$GATEWAY_REPO/api/swagger-extras.yml" api-spec/gateway-swagger-extras.yml

	# Rewrite only the gateway entry; oam/loxilb objects (including their
	# hand-written notes) stay byte-for-byte untouched.
	GW_SHA="$(rev "$GATEWAY_REPO")" node - <<'EOF'
const fs = require('fs');
const p = 'api-spec/SOURCES.json';
const s = JSON.parse(fs.readFileSync(p, 'utf8'));
s.vendoredAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const crypto = require('crypto');
s.gateway = {
	repository: 'https://github.com/loxilb-io/loxilb-inference-gateway',
	readMode: 'immutable-git-blobs',
	sha256: Object.fromEntries(['gateway-swagger.yml', 'gateway-swagger-extras.yml'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync('api-spec/' + file)).digest('hex')])),
	repo: 'loxilb-inference-gateway',
	path: 'api/swagger.yml + api/swagger-extras.yml',
	commit: process.env.GW_SHA,
	dirty: false,
	note: 'clean re-vendor via sync-specs.sh --only gateway from a detached checkout; byte-identical to the recorded commit',
};
fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
EOF
	echo "vendored gateway specs from $(rev "$GATEWAY_REPO"):"
	cat api-spec/SOURCES.json
	exit 0
fi

# Full API sync also reads immutable committed bytes without regenerating OAM.
# Metric provenance remains independently pinned via --only manifest.
exec node "$(dirname "$0")/sync-specs.mjs" --model general \
  --gateway-repo "$GATEWAY_REPO" --gateway-revision "$(rev "$GATEWAY_REPO")" \
  --oam-repo "$OAM_REPO" --oam-revision "$(rev "$OAM_REPO")"
