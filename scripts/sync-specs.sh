#!/usr/bin/env bash
# Vendor immutable producer blobs; never modify source repositories.
set -euo pipefail
exec node "$(dirname "$0")/sync-specs.mjs" "$@"
