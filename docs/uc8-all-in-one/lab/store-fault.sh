#!/usr/bin/env bash
# An unreachable host route is restricted to this Compose Gateway and DB.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
mode=${1:-}; [[ "$mode" = on || "$mode" = off ]] || { echo 'Usage: bash store-fault.sh on|off' >&2; exit 1; }
gateway=$(docker compose ps -q gateway); database=$(docker compose ps -q postgres)
[ -n "$gateway" ] && [ -n "$database" ] || { echo 'Gateway/DB is absent' >&2; exit 1; }
project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$gateway")
[[ "$project" =~ ^uc8-manual(-[a-z0-9]+)*$ ]] || { echo 'Unexpected project; refusing.' >&2; exit 1; }
[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$database")" = "$project" ] || exit 1
ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$database")
[[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Invalid DB address.' >&2; exit 1; }
marker=/tmp/uc8-manual-store-fault-owned
route=$(docker exec "$gateway" ip -4 route show exact "$ip/32" | awk '{$1=$1;print}')
if [ "$mode" = on ]; then
 [ -z "$route" ] || { echo 'Exact DB route already exists; refusing to overwrite.' >&2; exit 1; }
 if docker exec "$gateway" test -e "$marker"; then echo 'Fault marker exists; refusing.' >&2; exit 1; fi
 token=$(openssl rand -hex 16)
 docker exec "$gateway" sh -c 'printf "%s" "$2" > "$1"' sh "$marker" "$token"
 docker exec -d "$gateway" sh -c 'sleep 120; if test -f "$1" && test "$(cat "$1")" = "$3"; then ip route del unreachable "$2/32" 2>/dev/null || true; rm -f "$1"; fi' sh "$marker" "$ip" "$token"
 if ! docker exec "$gateway" ip route add unreachable "$ip/32"; then docker exec "$gateway" rm -f "$marker"; exit 1; fi
 echo 'Store path blocked inside the owned Gateway; automatic recovery is armed for 120 seconds.'
else
 if ! docker exec "$gateway" test -f "$marker"; then
  [ -z "$route" ] || { echo 'Unexpected route without marker; refusing.' >&2; exit 1; }
  echo 'No owned fault remains.'; exit 0
 fi
 case "$route" in "unreachable $ip"|"unreachable $ip/32") docker exec "$gateway" ip route del unreachable "$ip/32";; '') :;; *) echo 'Unexpected route; refusing to remove.' >&2; exit 1;; esac
 docker exec "$gateway" rm -f "$marker"
 echo 'Owned route removed; use UI Refresh and status.sh to verify recovery.'
fi
