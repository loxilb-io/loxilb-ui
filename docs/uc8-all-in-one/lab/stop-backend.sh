#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
# Preserve volumes and secrets for diagnosis and deliberate retention.
docker compose down
echo 'UC-8 containers and network stopped; volumes and private/ remain.'
