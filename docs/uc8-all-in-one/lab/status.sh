#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
docker compose ps -a
for attempt in $(seq 1 60); do
 if docker compose exec -T client python -c 'import urllib.request; urls=["http://gateway:11111/netlox/v1/status/ready","http://gateway:11111/netlox/v1/config/ai/objective","http://gateway:11111/netlox/v1/config/ai/apikey","http://oam:8080/oam/health","http://backend:8080/health","http://backend-other:8080/health","http://ui:8080/netlox/"]; [urllib.request.urlopen(u,timeout=3).close() for u in urls]' >/dev/null 2>&1; then
   printf 'Gateway readiness, objective, API keys, OAM, both backends and UI: HTTP 200\n'
   gateway=$(docker compose ps -q gateway); backend=$(docker compose ps -q backend); other=$(docker compose ps -q backend-other)
   docker inspect -f 'Gateway IP: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$gateway"
   docker inspect -f 'Backend IP: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$backend"
   docker inspect -f 'Other backend IP: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$other"
   exit 0
 fi
 sleep 1
done
echo 'Readiness failed. Keep the project and inspect sanitized diagnostics; do not proceed.' >&2
exit 1
